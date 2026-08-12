import webpush from 'web-push';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import { logger } from './logger.js';

let vapidPublicKey = null;

export async function initWebPush() {
  try {
    let vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY
    };

    if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
      const dbPubKey = await Settings.findOne({ key: 'vapid_public_key' });
      const dbPrivKey = await Settings.findOne({ key: 'vapid_private_key' });

      if (dbPubKey && dbPrivKey) {
        vapidKeys.publicKey = dbPubKey.value;
        vapidKeys.privateKey = dbPrivKey.value;
        logger.info('Retrieved VAPID keys from Settings database collection.');
      } else {
        const generated = webpush.generateVAPIDKeys();
        vapidKeys.publicKey = generated.publicKey;
        vapidKeys.privateKey = generated.privateKey;

        await Settings.updateOne({ key: 'vapid_public_key' }, { value: generated.publicKey }, { upsert: true });
        await Settings.updateOne({ key: 'vapid_private_key' }, { value: generated.privateKey }, { upsert: true });
        logger.info('Generated new VAPID keys and saved them in Settings database collection.');
      }
    }

    vapidPublicKey = vapidKeys.publicKey;

    webpush.setVapidDetails(
      'mailto:support@dseu.unfiltered',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
    logger.info('Web Push notification settings configured successfully.');
  } catch (error) {
    logger.error('Failed to initialize Web Push settings:', error);
  }
}

export function getVapidPublicKey() {
  return vapidPublicKey;
}

export async function sendPushNotifications(message, senderId) {
  try {
    // Find all users with active push subscriptions who are not the sender
    const recipients = await User.find({
      _id: { $ne: senderId },
      pushSubscriptions: { $exists: true, $not: { $size: 0 } }
    });

    if (recipients.length === 0) return;

    const payload = JSON.stringify({
      title: `New Message from ${message.sender?.displayName || 'Anonymous'}`,
      body: message.text || 'Image Attachment',
      url: '/'
    });

    const promises = [];

    for (const user of recipients) {
      for (const sub of user.pushSubscriptions) {
        promises.push(
          webpush.sendNotification(sub, payload).catch(async (err) => {
            // Remove expired/invalid subscriptions from database
            if (err.statusCode === 404 || err.statusCode === 410) {
              await User.updateOne(
                { _id: user._id },
                { $pull: { pushSubscriptions: { endpoint: sub.endpoint } } }
              );
            }
          })
        );
      }
    }

    await Promise.all(promises);
  } catch (err) {
    logger.error('Error sending push notifications to recipients:', err);
  }
}
