const Razorpay = require('razorpay');
const { MongoClient } = require('mongodb');

// SHSD Razorpay Account Credentials
const shsdRazorpay = new Razorpay({
  key_id: 'rzp_live_T6ejMqxSj3mqP3',
  key_secret: 'tazQiJ4FG5sArRGuuhM7kcCQ'
});

// Your unified MongoDB connection string
const mongoUri = "mongodb+srv://hkvidya_admin:tpr_hkvidya%40admin@hkvidyacluster.i73cc1g.mongodb.net/hkvidya_db?retryWrites=true&w=majority&appName=hkvidyaCluster";

async function importShsdSubscriptions() {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db('hkvidya_db');
    // FIX: Targeting 'donations' collection instead of 'hkvidyasubscriptions'
    const collection = db.collection('donations'); 

    console.log('Fetching subscriptions from the SHSD Razorpay account...');
    
    let skip = 0;
    let count = 50;
    let hasMore = true;
    let totalImported = 0;

    while (hasMore) {
      const response = await shsdRazorpay.subscriptions.all({ skip, count });
      const subscriptions = response.items || response;

      if (!subscriptions || subscriptions.length === 0) {
        hasMore = false;
        break;
      }

      for (const sub of subscriptions) {
        const subData = {
          razorpay_subscription_id: sub.id,
          plan_id: sub.plan_id,
          status: sub.status,
          payment_status: sub.status,
          notes: sub.notes || {},
          donor_name: sub.notes?.full_name || sub.notes?.name || 'Unknown',
          email: sub.notes?.email || '',
          phone: sub.notes?.phone || '',
          accountSource: 'shsd', // Tagging for dropdown filtering
          createdAt: new Date(sub.created_at * 1000)
        };

        await collection.updateOne(
          { razorpay_subscription_id: sub.id },
          { $set: subData },
          { upsert: true }
        );
        totalImported++;
      }

      console.log(`Processed batch up to skip: ${skip}, total so far: ${totalImported}`);
      skip += count;
      if (subscriptions.length < count) {
        hasMore = false;
      }
    }

    console.log(`Successfully imported ${totalImported} historical SHSD records into hkvidya_db!`);
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await client.close();
  }
}

importShsdSubscriptions();
