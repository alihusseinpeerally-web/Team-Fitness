import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// DATABASE HELPER FUNCTIONS
// ============================================================

// --- USERS ---
export async function getUsers() {
  const { data } = await supabase.from("users").select("*").order("alias");
  return data || [];
}

export async function loginUser(alias, pin) {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("alias", alias)
    .eq("pin", pin)
    .single();
  return data;
}

export async function updatePin(userId, newPin) {
  const { error } = await supabase
    .from("users")
    .update({ pin: newPin })
    .eq("id", userId);
  return !error;
}

// --- DAILY LOGS ---
export async function getDailyLog(userId, date) {
  const { data } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", date)
    .single();
  return data;
}

export async function getAllDailyLogs(userId) {
  const { data } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .order("log_date");
  return data || [];
}

export async function getAllLogs() {
  const { data } = await supabase
    .from("daily_logs")
    .select("*")
    .order("log_date");
  return data || [];
}

export async function upsertDailyLog(userId, date, logData) {
  const { data, error } = await supabase
    .from("daily_logs")
    .upsert(
      { user_id: userId, log_date: date, ...logData, updated_at: new Date().toISOString() },
      { onConflict: "user_id,log_date" }
    )
    .select()
    .single();
  return data;
}

// --- EXERCISE TARGETS ---
export async function getExerciseTargets(userId) {
  const { data } = await supabase
    .from("exercise_targets")
    .select("*")
    .eq("user_id", userId);
  return data || [];
}

export async function upsertExerciseTarget(userId, exerciseName, targets) {
  const { data } = await supabase
    .from("exercise_targets")
    .upsert(
      { user_id: userId, exercise_name: exerciseName, ...targets, updated_at: new Date().toISOString() },
      { onConflict: "user_id,exercise_name" }
    )
    .select()
    .single();
  return data;
}

// --- EXERCISE LOGS ---
export async function getExerciseLogs(userId, weekNum) {
  const { data } = await supabase
    .from("exercise_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("week_num", weekNum);
  return data || [];
}

export async function getAllExerciseLogs(userId) {
  const { data } = await supabase
    .from("exercise_logs")
    .select("*")
    .eq("user_id", userId)
    .order("week_num");
  return data || [];
}

export async function upsertExerciseLog(userId, weekNum, exerciseName, bestValue, proofPhoto) {
  const payload = {
    user_id: userId,
    week_num: weekNum,
    exercise_name: exerciseName,
    best_value: bestValue,
  };
  if (proofPhoto !== undefined) payload.proof_photo = proofPhoto;
  const { data } = await supabase
    .from("exercise_logs")
    .upsert(payload, { onConflict: "user_id,week_num,exercise_name" })
    .select()
    .single();
  return data;
}

export async function updateProofStatus(userId, weekNum, exerciseName, status) {
  const { error } = await supabase
    .from("exercise_logs")
    .update({ proof_status: status })
    .eq("user_id", userId)
    .eq("week_num", weekNum)
    .eq("exercise_name", exerciseName);
  return !error;
}

// --- WEIGHTS ---
export async function getWeights(userId) {
  const { data } = await supabase
    .from("weights")
    .select("*")
    .eq("user_id", userId)
    .order("week_num");
  return data || [];
}

export async function upsertWeight(userId, weekNum, weightKg) {
  const { data } = await supabase
    .from("weights")
    .upsert(
      { user_id: userId, week_num: weekNum, weight_kg: weightKg },
      { onConflict: "user_id,week_num" }
    )
    .select()
    .single();
  return data;
}

// --- FLAGS ---
export async function getFlags() {
  const { data } = await supabase.from("flags").select("*").order("created_at", { ascending: false });
  return data || [];
}

export async function createFlag(userId, logDate, modId, message, severity, deduction) {
  const { data } = await supabase
    .from("flags")
    .insert({ user_id: userId, log_date: logDate, mod_id: modId, message, severity, deduction })
    .select()
    .single();
  return data;
}

export async function respondToFlag(flagId, response) {
  const { error } = await supabase
    .from("flags")
    .update({ response })
    .eq("id", flagId);
  return !error;
}

export async function resolveFlag(flagId, genuine) {
  const { error } = await supabase
    .from("flags")
    .update({ resolved: true, genuine })
    .eq("id", flagId);
  return !error;
}

// --- COMMENTS ---
export async function getComments() {
  const { data } = await supabase.from("comments").select("*").order("created_at");
  return data || [];
}

export async function createComment(userId, logDate, authorId, message) {
  const { data } = await supabase
    .from("comments")
    .insert({ user_id: userId, log_date: logDate, author_id: authorId, message })
    .select()
    .single();
  return data;
}

// --- CHEAT DAYS ---
export async function getCheatDays(userId) {
  const { data } = await supabase
    .from("cheat_days")
    .select("*")
    .eq("user_id", userId);
  return data || [];
}

export async function upsertCheatDay(userId, weekNum, dayIndex) {
  const { data } = await supabase
    .from("cheat_days")
    .upsert(
      { user_id: userId, week_num: weekNum, day_index: dayIndex },
      { onConflict: "user_id,week_num" }
    )
    .select()
    .single();
  return data;
}

export async function deleteCheatDay(userId, weekNum) {
  const { error } = await supabase
    .from("cheat_days")
    .delete()
    .eq("user_id", userId)
    .eq("week_num", weekNum);
  return !error;
}

// --- PENDING EXERCISES ---
export async function getPendingExercises() {
  const { data } = await supabase.from("pending_exercises").select("*").order("created_at");
  return data || [];
}

export async function requestExercise(userId, exerciseName, unit) {
  const { data } = await supabase
    .from("pending_exercises")
    .insert({ user_id: userId, exercise_name: exerciseName, unit })
    .select()
    .single();
  return data;
}

export async function approveExercise(exerciseId, approved) {
  const { error } = await supabase
    .from("pending_exercises")
    .update({ status: approved ? "approved" : "rejected" })
    .eq("id", exerciseId);
  return !error;
}

// --- H2H CHALLENGES ---
export async function getH2HChallenges() {
  const { data } = await supabase.from("h2h_challenges").select("*").order("created_at", { ascending: false });
  return data || [];
}

export async function createH2H(fromUserId, toUserId, weekNum) {
  const { data } = await supabase
    .from("h2h_challenges")
    .insert({ from_user_id: fromUserId, to_user_id: toUserId, week_num: weekNum })
    .select()
    .single();
  return data;
}

export async function respondH2H(challengeId, accepted) {
  const { error } = await supabase
    .from("h2h_challenges")
    .update({ accepted })
    .eq("id", challengeId);
  return !error;
}

// --- BULK EXPORT (for admin) ---
export async function exportAllData() {
  const [users, logs, targets, exLogs, weights, flags, comments, cheats, pending, h2h] = await Promise.all([
    supabase.from("users").select("*"),
    supabase.from("daily_logs").select("*"),
    supabase.from("exercise_targets").select("*"),
    supabase.from("exercise_logs").select("*"),
    supabase.from("weights").select("*"),
    supabase.from("flags").select("*"),
    supabase.from("comments").select("*"),
    supabase.from("cheat_days").select("*"),
    supabase.from("pending_exercises").select("*"),
    supabase.from("h2h_challenges").select("*"),
  ]);
  return {
    users: users.data,
    daily_logs: logs.data,
    exercise_targets: targets.data,
    exercise_logs: exLogs.data,
    weights: weights.data,
    flags: flags.data,
    comments: comments.data,
    cheat_days: cheats.data,
    pending_exercises: pending.data,
    h2h_challenges: h2h.data,
    exported_at: new Date().toISOString(),
  };
}
