const HkvidyaSubscription = require('../models/HkvidyaSubscription');
const HkvidyaOverlay = require('../models/HkvidyaOverlay');
const Razorpay = require('razorpay');
const axios = require('axios');

exports.getAllHkvidyaSubscriptions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [subscriptions, totalCount] = await Promise.all([
      HkvidyaSubscription.find().skip(skip).limit(limit).lean(),
      HkvidyaSubscription.countDocuments()
    ]);

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

exports.pushToDhanunjaya = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    const subscription = await HkvidyaSubscription.findOne({ razorpay_subscription_id: subscriptionId }).lean();
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found in read-only hkvidya cluster' });
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

      return res.status(200).json({ success: true, dryRun: true, payload });
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

      return res.status(200).json({ success: true, message: 'Synced to Dhanunjaya', data: response.data });
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

      return res.status(500).json({ success: false, message: 'Dhanunjaya sync failed', error: errorMessage });
    }
  } catch (error) {
    console.error('Error in pushToDhanunjaya:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
