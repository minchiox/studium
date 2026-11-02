import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'studium.examSeat';
/** Stored when the student chose to see every location. */
const ALL = '*';

/** The exam seat chosen by the student: a location, `null` for all, `undefined` if never chosen. */
export async function loadExamSeat(): Promise<string | null | undefined> {
  const v = await AsyncStorage.getItem(KEY).catch(() => null);
  if (v === null) return undefined;
  return v === ALL ? null : v;
}

export async function saveExamSeat(seat: string | null): Promise<void> {
  await AsyncStorage.setItem(KEY, seat ?? ALL);
}
