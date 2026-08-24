// src/services/notificationJobService.ts

import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { currentTimestampISO } from './dateService';

export interface NotificationJob {
  id: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  eventType: string;
  dueDate: string;
  reminderDate: string;
  channel: 'fcm' | 'in_app' | 'email';
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
  sentAt?: string;
}

const jobCol = (uid: string) => collection(db, 'users', uid, 'notificationJobs');
const jobDoc = (uid: string, jobId: string) => doc(db, 'users', uid, 'notificationJobs', jobId);

/**
 * Creates a deterministic notification job for a scheduled event.
 * Idempotent: same parameters produce the exact same job ID so duplicate jobs are never created.
 */
export function getDeterministicJobId(
  sourceType: string,
  sourceId: string,
  reminderDate: string,
): string {
  const sType = sourceType.replace(/[^a-zA-Z0-9_]/g, '_');
  const sId = sourceId.replace(/[^a-zA-Z0-9_]/g, '_');
  return `notif_job_${sType}_${sId}_${reminderDate}`;
}

export async function createNotificationJob(
  uid: string,
  payload: Omit<NotificationJob, 'id' | 'createdAt' | 'status'>,
): Promise<NotificationJob> {
  const id = getDeterministicJobId(payload.sourceType, payload.sourceId, payload.reminderDate);
  const t = currentTimestampISO();
  const job: NotificationJob = {
    ...payload,
    id,
    userId: uid,
    status: 'pending',
    createdAt: t,
  };
  await setDoc(jobDoc(uid, id), job, { merge: true });
  return job;
}

export async function fetchPendingNotificationJobs(uid: string): Promise<NotificationJob[]> {
  const snap = await getDocs(jobCol(uid));
  const jobs = snap.docs.map((d) => d.data() as NotificationJob);
  return jobs.filter((j) => j.status === 'pending');
}
