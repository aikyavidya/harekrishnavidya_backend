const HkvidyaSubscription = require('../models/HkvidyaSubscription');
const HkvidyaOverlay = require('../models/HkvidyaOverlay');
const Razorpay = require('razorpay');
const axios = require('axios');

exports.getAllHkvidyaSubscriptions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search;
    const sort = req.query.sort || 'latest';
    const category = req.query.category;
    const account = req.query.account || 'teja';

    let filter = {};
    if (search) {
      filter = {
        $or: [
          { razorpay_subscription_id: { $regex: search, $options: 'i' } },
          { full_name: { $regex: search, $options: 'i' } },
          { donor_name: { $regex: search, $options: 'i' } }, // For SHSD model compatibility
          { email: { $regex: search, $options: 'i' } }
        ]
      };
    }

    if (category && category !== 'All') {
      filter.payment_status = category.toLowerCase();
    }

    // NEW: Select Model dynamically
    const ShsdSubscription = require('../models/ShsdSubscription');
    const TargetModel = account === 'shsd' ? ShsdSubscription : HkvidyaSubscription;

    // We no longer strictly need the accountSource filter since they are in separate models/collections,
    // but we can leave it for Teja just in case.
    if (account !== 'shsd') {
      filter.accountSource = { $ne: 'shsd' }; // Matches 'teja' or missing/null
    }

    const sortOptions = sort === 'oldest' 
      ? { razorpay_start_at: 1, created_at: 1, createdAt: 1 } 
      : { razorpay_start_at: -1, created_at: -1, createdAt: -1 };

    const [subscriptionsRaw, totalCount] = await Promise.all([
      TargetModel.find(filter).sort(sortOptions).skip(skip).limit(limit),
      TargetModel.countDocuments(filter)
    ]);
    
    // We convert to JSON explicitly here so virtuals are evaluated correctly (like amount, full_name, created_at)
    const subscriptions = subscriptionsRaw.map(doc => doc.toJSON({ virtuals: true }));

    const subscriptionIds = subscriptions.map(s => s.razorpay_subscription_id).filter(Boolean);
    const overlays = await HkvidyaOverlay.find({ razorpay_subscription_id: { $in: subscriptionIds } }).lean();

    const overlayMap = overlays.reduce((acc, overlay) => {
      acc[overlay.razorpay_subscription_id] = overlay;
      return acc;
    }, {});

    const mergedSubscriptions = subscriptions.map(sub => {
      const overlay = overlayMap[sub.razorpay_subscription_id] || {
        wants80G: false,
        fullAddress: '',
        panNumber: '',
        assignedEmployee: '',
        dhanunjayaSynced: false,
        dhanunjayaSyncFailed: false,
        lastSyncedAt: null
      };

      return {
        ...sub,
        overlay
      };
    });

    res.status(200).json({
      success: true,
      subscriptions: mergedSubscriptions,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateOverlay = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { wants80G, fullAddress, panNumber, assignedEmployee } = req.body;

    const updateData = {};
    if (wants80G !== undefined) updateData.wants80G = wants80G;
    if (fullAddress !== undefined) updateData.fullAddress = fullAddress;
    if (panNumber !== undefined) updateData.panNumber = panNumber;
    if (assignedEmployee !== undefined) updateData.assignedEmployee = assignedEmployee;

    const overlay = await HkvidyaOverlay.findOneAndUpdate(
      { razorpay_subscription_id: subscriptionId },
      { $set: updateData },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json({ success: true, overlay });
  } catch (error) {
    console.error('Error updating overlay:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateDonorInfo = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { full_name, email, phone, area_of_stay } = req.body;

    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (area_of_stay !== undefined) updateData.area_of_stay = area_of_stay;

    const subscription = await HkvidyaSubscription.findOneAndUpdate(
      { razorpay_subscription_id: subscriptionId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    res.status(200).json({ success: true, subscription });
  } catch (error) {
    console.error('Error updating donor info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.syncWithRazorpay = async (req, res) => {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const statusMap = {
      created: "pending",
      authenticated: "pending",
      active: "active",
      pending: "pending",
      halted: "halted",
      cancelled: "cancelled",
      completed: "completed",
      expired: "expired"
    };

    let skip = 0;
    const count = 50;
    let hasMore = true;
    const metrics = { totalChecked: 0, missingCreated: 0, mismatchedCorrected: 0, alreadyCorrect: 0 };

    while (hasMore) {
      const response = await razorpay.subscriptions.all({ skip, count });
      const subscriptions = response.items || [];
      if (subscriptions.length === 0) { hasMore = false; break; }

      for (const sub of subscriptions) {
        metrics.totalChecked++;
        const mappedStatus = statusMap[sub.status] || sub.status;
        const existingDoc = await HkvidyaSubscription.findOne({ razorpay_subscription_id: sub.id });

        if (!existingDoc) {
          let resolvedAmount = sub.notes?.amount ? Number(sub.notes.amount) : 0;
          if (!resolvedAmount && sub.plan_id) {
            try {
              const plan = await razorpay.plans.fetch(sub.plan_id);
              resolvedAmount = plan.item.amount / 100;
            } catch (planErr) {
              console.warn(`Could not fetch plan for subscription ${sub.id}:`, planErr.message);
            }
          }
          const setOnInsert = {
            full_name: sub.notes?.full_name || "Unknown (created via reconcile)",
            email: sub.notes?.email || "unknown@reconcile.local",
            phone: sub.notes?.phone || "0000000000",
            pan: sub.notes?.pan || "",
            plan_type: sub.notes?.plan_type || "",
            children_count: sub.notes?.children_count ? Number(sub.notes.children_count) : undefined,
            amount: resolvedAmount,
            area_of_stay: sub.notes?.area_of_stay || "",
            address_line_1: sub.notes?.address || "",
            pincode: sub.notes?.pincode || "",
            city: sub.notes?.city || "",
            locality: sub.notes?.locality || "",
            state: sub.notes?.state || "",
            country: sub.notes?.country || "",
            wants_80g: sub.notes?.wants_80g === "true",
            payment_mode: "autopay"
          };
          await HkvidyaSubscription.findOneAndUpdate(
            { razorpay_subscription_id: sub.id },
            { $set: { payment_status: mappedStatus }, $setOnInsert: setOnInsert },
            { upsert: true, runValidators: true }
          );
          metrics.missingCreated++;
        } else if (existingDoc.payment_status !== mappedStatus) {
          existingDoc.payment_status = mappedStatus;
          await existingDoc.save();
          metrics.mismatchedCorrected++;
        } else {
          metrics.alreadyCorrect++;
        }
      }
      skip += count;
      if (subscriptions.length < count) hasMore = false;
    }

    res.status(200).json({ success: true, metrics });
  } catch (error) {
    console.error('Razorpay sync error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const pushSingleSubscriptionToDhanunjaya = async (subscriptionId) => {
  try {
    const subscription = await HkvidyaSubscription.findOne({ razorpay_subscription_id: subscriptionId }).lean();
    if (!subscription) {
      return { success: false, status: 404, message: 'Subscription not found in read-only hkvidya cluster' };
    }

    const overlay = await HkvidyaOverlay.findOne({ razorpay_subscription_id: subscriptionId }).lean() || {};

    const mergedName = subscription.full_name || '';
    const mergedPan = overlay.panNumber || subscription.pan || '';
    const mergedPhone = subscription.phone || '';
    const mergedEmail = subscription.email || '';
    const mergedAddressLine1 = overlay.fullAddress || subscription.address_line_1 || '';
    const mergedAddressLine2 = subscription.address_line_2 || '';
    const mergedCity = subscription.city || '';
    const mergedState = subscription.state || '';
    const mergedCountry = subscription.country || 'India';
    const mergedPincode = subscription.pincode || '';
    const mergedFullAddress = overlay.fullAddress || 
      [mergedAddressLine1, mergedAddressLine2, mergedCity, mergedState, mergedCountry, mergedPincode].filter(Boolean).join(', ');
    
    // For boolean overlay fields, check undefined since they default to false
    const wants80G = overlay.wants80G !== undefined ? overlay.wants80G : (subscription.wants_80g || false);

    const payload = {
      donation: {
        receipt_series: "BJHR-WEB-.YY..MM.-.######",
        payment_method: "Gateway",
        print_remarks_on_receipt: true,
        try_patron_tagging: false,
        donation_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        trust: "Aikya Foundation",
        preacher: "HKWEB",
        donor_name: mergedName,
        pan_no: mergedPan,
        mobile: mergedPhone,
        email: mergedEmail,
        address: mergedFullAddress,
        separated_address: {
          type: "Residential",
          address_line_1: mergedAddressLine1,
          address_line_2: mergedAddressLine2,
          city: mergedCity,
          state: mergedState,
          country: mergedCountry,
          pin_code: mergedPincode
        },
        amount: subscription.amount || 0,
        seva: "HIB-GD-EDUC-VIDYADAN",
        remarks: subscriptionId,
        atg_required: wants80G
      }
    };

    const isDryRun = process.env.DHANANJAYA_DRY_RUN === 'true';

    if (isDryRun) {
      console.log('[Dhanunjaya DRY RUN]', JSON.stringify(payload, null, 2));
      
      // Upsert overlay just for the syncLog if it didn't exist
      await HkvidyaOverlay.findOneAndUpdate(
        { razorpay_subscription_id: subscriptionId },
        { 
          $push: { 
            syncLog: { 
              status: 'dry_run', 
              responseMessage: 'Dry run execution', 
              pushedPayload: payload 
            }
          }
        },
        { upsert: true }
      );

      return { success: true, status: 200, dryRun: true, payload };
    }

    const apiUrl = process.env.DHANANJAYA_API_URL;
    const authToken = process.env.DHANANJAYA_AUTH_TOKEN;

    if (!apiUrl || !authToken) {
      throw new Error('Dhanunjaya API URL or Auth Token not configured');
    }

    try {
      const response = await axios.post(apiUrl, payload, {
        headers: {
          'Authorization': `token ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      await HkvidyaOverlay.findOneAndUpdate(
        { razorpay_subscription_id: subscriptionId },
        { 
          $set: { 
            dhanunjayaSynced: true, 
            dhanunjayaSyncFailed: false, 
            lastSyncedAt: new Date() 
          },
          $push: { 
            syncLog: { 
              status: 'success', 
              responseMessage: 'Synced successfully', 
              pushedPayload: payload 
            }
          }
        },
        { upsert: true }
      );

      return { success: true, status: 200, message: 'Synced to Dhanunjaya', data: response.data };
    } catch (apiError) {
      const errorMessage = apiError.response ? JSON.stringify(apiError.response.data) : apiError.message;
      
      await HkvidyaOverlay.findOneAndUpdate(
        { razorpay_subscription_id: subscriptionId },
        { 
          $set: { dhanunjayaSyncFailed: true },
          $push: { 
            syncLog: { 
              status: 'failed', 
              responseMessage: errorMessage, 
              pushedPayload: payload 
            }
          }
        },
        { upsert: true }
      );

      return { success: false, status: 500, message: 'Dhanunjaya sync failed', error: errorMessage };
    }
  } catch (error) {
    console.error('Error in pushSingleSubscriptionToDhanunjaya:', error);
    return { success: false, status: 500, error: error.message };
  }
};

exports.pushToDhanunjaya = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const result = await pushSingleSubscriptionToDhanunjaya(subscriptionId);

    if (!result.success) {
      if (result.status === 404) {
        return res.status(404).json({ success: false, message: result.message });
      }
      if (result.status === 500 && result.message === 'Dhanunjaya sync failed') {
        return res.status(500).json({ success: false, message: result.message, error: result.error });
      }
      return res.status(500).json({ success: false, error: result.error });
    }

    if (result.dryRun) {
      return res.status(200).json({ success: true, dryRun: true, payload: result.payload });
    }
    return res.status(200).json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in pushToDhanunjaya route:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.bulkPushToDhanunjaya = async (req, res) => {
  try {
    const { subscriptionIds } = req.body;
    if (!Array.isArray(subscriptionIds)) {
      return res.status(400).json({ success: false, message: 'subscriptionIds must be an array' });
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const results = [];
    let pushedCount = 0;
    let failedCount = 0;

    for (const subscriptionId of subscriptionIds) {
      const result = await pushSingleSubscriptionToDhanunjaya(subscriptionId);
      
      if (result.success) {
        pushedCount++;
      } else {
        failedCount++;
      }

      let finalMessage = result.message || result.error || 'Unknown error';
      if (result.success && result.dryRun) {
        finalMessage = 'Dry run executed successfully (no data sent to Dhanunjaya)';
      }

      results.push({
        subscriptionId,
        success: result.success,
        dryRun: result.dryRun || false,
        message: finalMessage
      });
      
      await sleep(250);
    }

    res.status(200).json({
      success: true,
      results,
      summary: {
        total: subscriptionIds.length,
        pushed: pushedCount,
        failed: failedCount
      }
    });
  } catch (error) {
    console.error('Error in bulkPushToDhanunjaya:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const extractReadableErrorMessage = (rawMessage) => {
  try {
    const parsed = JSON.parse(rawMessage);
    if (parsed._server_messages) {
      const messagesArray = JSON.parse(parsed._server_messages);
      if (Array.isArray(messagesArray) && messagesArray.length > 0) {
        const firstMessageObj = JSON.parse(messagesArray[0]);
        if (firstMessageObj && firstMessageObj.message) {
          return firstMessageObj.message.replace(/<\/?[^>]+(>|$)/g, "");
        }
      }
    }
    
    if (parsed.exception) {
      return parsed.exception;
    }
    
    return rawMessage;
  } catch (error) {
    return rawMessage;
  }
};

exports.getDhanunjayaSyncLog = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const overlays = await HkvidyaOverlay.find({
      syncLog: { $exists: true, $not: { $size: 0 } }
    }).lean();

    const subscriptionIds = [...new Set(overlays.map(o => o.razorpay_subscription_id).filter(Boolean))];
    
    const subscriptions = await HkvidyaSubscription.find({
      razorpay_subscription_id: { $in: subscriptionIds }
    }).lean();

    const nameMap = subscriptions.reduce((acc, sub) => {
      acc[sub.razorpay_subscription_id] = sub.full_name;
      return acc;
    }, {});

    let allLogs = [];
    overlays.forEach(overlay => {
      if (Array.isArray(overlay.syncLog)) {
        overlay.syncLog.forEach(log => {
          allLogs.push({
            razorpay_subscription_id: overlay.razorpay_subscription_id,
            donor_name: nameMap[overlay.razorpay_subscription_id] || "Unknown",
            timestamp: log.timestamp,
            status: log.status,
            responseMessage: extractReadableErrorMessage(log.responseMessage)
          });
        });
      }
    });

    allLogs.sort((a, b) => {
      const dateA = new Date(a.timestamp || 0);
      const dateB = new Date(b.timestamp || 0);
      return dateB - dateA;
    });

    const totalCount = allLogs.length;
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;
    
    const paginatedLogs = allLogs.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      logs: paginatedLogs,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching Dhanunjaya sync logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getSubscriptionDetail = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    const subscription = await HkvidyaSubscription.findOne({ razorpay_subscription_id: subscriptionId }).lean();
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    const rawOverlay = await HkvidyaOverlay.findOne({ razorpay_subscription_id: subscriptionId }).lean();
    const overlay = rawOverlay || {
      wants80G: false,
      fullAddress: '',
      panNumber: '',
      assignedEmployee: '',
      dhanunjayaSynced: false,
      dhanunjayaSyncFailed: false,
      lastSyncedAt: null,
      syncLog: []
    };

    if (overlay.syncLog && Array.isArray(overlay.syncLog)) {
      overlay.syncLog = overlay.syncLog.map(log => ({
        ...log,
        responseMessage: extractReadableErrorMessage(log.responseMessage)
      }));
    }

    let razorpayLiveData = {
      paymentMethod: null,
      nextChargeAt: null,
      paidCount: null,
      totalCount: null,
      planPeriod: null,
      planInterval: null,
      customerId: null
    };

    try {
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });

      const rzpSub = await razorpay.subscriptions.fetch(subscriptionId);
      const chargeTimestamp = rzpSub.next_charge_at || rzpSub.charge_at;

      razorpayLiveData.paymentMethod = rzpSub.payment_method || null;
      razorpayLiveData.nextChargeAt = chargeTimestamp ? new Date(chargeTimestamp * 1000) : null;
      razorpayLiveData.paidCount = rzpSub.paid_count !== undefined ? rzpSub.paid_count : null;
      razorpayLiveData.totalCount = rzpSub.total_count !== undefined ? rzpSub.total_count : null;
      razorpayLiveData.customerId = rzpSub.customer_id || null;

      if (rzpSub.plan_id) {
        const plan = await razorpay.plans.fetch(rzpSub.plan_id);
        razorpayLiveData.planPeriod = plan.period || null;
        razorpayLiveData.planInterval = plan.interval || null;
      }
    } catch (rzpError) {
      console.error('Error fetching Razorpay live data:', rzpError);
    }

    return res.status(200).json({
      success: true,
      subscription: {
        ...subscription,
        overlay,
        razorpayLiveData
      }
    });
  } catch (error) {
    console.error('Error fetching subscription detail:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.bulkResolvePaymentIds = async (req, res) => {
  try {
    const { paymentIds } = req.body;
    if (!Array.isArray(paymentIds)) {
      return res.status(400).json({ success: false, message: 'paymentIds must be an array' });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const results = [];
    let resolvedCount = 0;
    let failedCount = 0;

    for (const paymentId of paymentIds) {
      try {
        const payment = await razorpay.payments.fetch(paymentId);
        
        if (!payment.invoice_id) {
          results.push({
            paymentId,
            resolved: false,
            reason: 'Payment is not linked to any subscription',
            subscriptionId: null,
            subscriptionData: null
          });
          failedCount++;
          await sleep(250);
          continue;
        }

        const invoice = await razorpay.invoices.fetch(payment.invoice_id);
        await sleep(250);

        if (!invoice || !invoice.subscription_id) {
          results.push({
            paymentId,
            resolved: false,
            reason: 'Payment has an invoice but it is not linked to a subscription',
            subscriptionId: null,
            subscriptionData: null
          });
          failedCount++;
          await sleep(250);
          continue;
        }

        const subscriptionId = invoice.subscription_id;
        const subscription = await HkvidyaSubscription.findOne({ razorpay_subscription_id: subscriptionId }).lean();
        
        if (!subscription) {
          results.push({
            paymentId,
            resolved: false,
            reason: 'Subscription not found in our database',
            subscriptionId,
            subscriptionData: null
          });
          failedCount++;
        } else {
          const overlay = await HkvidyaOverlay.findOne({ razorpay_subscription_id: subscriptionId }).lean() || {
            wants80G: false,
            fullAddress: '',
            panNumber: '',
            assignedEmployee: '',
            dhanunjayaSynced: false,
            dhanunjayaSyncFailed: false,
            lastSyncedAt: null
          };

          results.push({
            paymentId,
            resolved: true,
            reason: null,
            subscriptionId,
            subscriptionData: {
              ...subscription,
              overlay,
              full_name: subscription.full_name,
              email: subscription.email,
              phone: subscription.phone,
              amount: subscription.amount,
              payment_status: subscription.payment_status,
              fullAddress: overlay.fullAddress,
              panNumber: overlay.panNumber,
              wants80G: overlay.wants80G
            }
          });
          resolvedCount++;
        }
      } catch (err) {
        results.push({
          paymentId,
          resolved: false,
          reason: err.message || 'Payment ID not found on Razorpay',
          subscriptionId: null,
          subscriptionData: null
        });
        failedCount++;
      }
      
      await sleep(250);
    }

    res.status(200).json({
      success: true,
      results,
      summary: {
        total: paymentIds.length,
        resolved: resolvedCount,
        failed: failedCount
      }
    });
  } catch (error) {
    console.error('Error in bulkResolvePaymentIds:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
