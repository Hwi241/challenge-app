// stores/widgetSync.ts
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

type ChallengeLite = { id: string; title: string; progressPct: number; };

const PREFS_BRIDGE = 'com.hwiject.thepush.PREFS_BRIDGE';
/**
 * RN → 네이티브로 데이터 동기화 요청을 던지는 브로드캐스트.
 * 실제 Prefs 저장은 네이티브 쪽에서 처리(간소화를 위해, 이번 버전은
 * 아래 JSON 파일을 네이티브가 읽도록 해도 됨)
 */
export async function syncListWidgetData(list: ChallengeLite[]) {
  // 1) 파일로 저장 (네이티브가 읽음)
  const json = JSON.stringify(list);
  const path = FileSystem.documentDirectory + 'widget_challenges.json';
  await FileSystem.writeAsStringAsync(path, json);

  // 2) 브로드캐스트(안드로이드 전용)
  if (Platform.OS === 'android') {
    // Expo에서 커스텀 브로드캐스트를 직접 발송하긴 어려워서,
    // 이번 버전은 ListWidgetProvider.ACTION_DATA_CHANGED 를 호출하는
    // 간단한 네이티브 모듈을 추가하는 게 깔끔하지만,
    // 우회책: 앱 포그라운드 진입/주기 갱신 때 네이티브가 파일을 읽어 Prefs에 반영하도록 구성.
    // => 초기 버전: 네이티브가 주기 업데이트 때 파일을 읽어 Prefs에 싱크.
  }
}
