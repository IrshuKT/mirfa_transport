
import { FirebaseMessaging } from '@capacitor-firebase/messaging'
import { Capacitor } from '@capacitor/core'
import api from '@/api/client'

export async function registerFCMToken() {
  if (!Capacitor.isNativePlatform()) {
    console.log('Not native platform, skipping FCM')
    return
  }

  try {
    const { receive } = await FirebaseMessaging.requestPermissions()
    console.log('FCM Permission result:', receive)  // ← check this

    if (receive !== 'granted') {
      console.warn('Push notification permission denied')
      return
    }

    const { token } = await FirebaseMessaging.getToken()
    console.log('FCM Token received:', token)       // ← check this

    if (!token) {
      console.error('FCM token is empty!')
      return
    }

    const response = await api.post('/drivers/me/fcm-token', { fcm_token: token })
    console.log('FCM token saved to backend:', response.data)  // ← check this

  } catch (err) {
    console.error('FCM registration failed:', err)  // ← check this
  }
}

export async function listenForPushNotifications() {
  if (!Capacitor.isNativePlatform()) return

  await FirebaseMessaging.addListener('notificationReceived', event => {
    console.log('Push received (foreground):', event.notification)
  })

  await FirebaseMessaging.addListener('notificationActionPerformed', event => {
    const data = event.notification.data as Record<string, string> | undefined
    const jobId = data?.job_id
    if (jobId) {
      window.location.href = `/my-jobs/${jobId}/view`
    }
  })
}