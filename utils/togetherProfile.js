import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOGETHER_PROFILE_KEY = 'record_room_profile';

export const loadTogetherDisplayName = async ({ storage = AsyncStorage } = {}) => {
  try {
    const raw = await storage.getItem(TOGETHER_PROFILE_KEY);
    const name = String(JSON.parse(raw || '{}')?.name ?? '').trim().slice(0, 40);
    return name || '멤버';
  } catch {
    return '멤버';
  }
};
