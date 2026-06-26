export const CALENDAR_RECORD_PROVIDER = 'calendarRecord';

export const CALENDAR_RECORD_STATUS = {
 NOT_CONNECTED: 'notConnected',
 CONNECTED: 'connected',
 PERMISSION_DENIED: 'permissionDenied',
 NO_WRITABLE_CALENDAR: 'noWritableCalendar',
 UNAVAILABLE: 'unavailable',
 ERROR: 'error',
};

export function getCalendarRecordModule() {
 try {
 return require('expo-calendar');
 } catch (error) {
 return null;
 }
}

export function isCalendarRecordLinked(calendarRecord = {}) {
 return calendarRecord?.enabled === true && calendarRecord?.status === CALENDAR_RECORD_STATUS.CONNECTED;
}

export function getCalendarDisplayTitle(calendar = {}) {
 return (
 calendar?.title ||
 calendar?.name ||
 calendar?.ownerAccount ||
 calendar?.source?.name ||
 calendar?.source?.title ||
 '선택된 캘린더'
 );
}

export function normalizeCalendarRecordSettings(calendarRecord = {}) {
 return {
 enabled: calendarRecord?.enabled === true,
 status: calendarRecord?.status || CALENDAR_RECORD_STATUS.NOT_CONNECTED,
 selectedCalendarId: calendarRecord?.selectedCalendarId || null,
 selectedCalendarTitle: calendarRecord?.selectedCalendarTitle || null,
 writeMode: calendarRecord?.writeMode || 'manual',
 updatedAt: calendarRecord?.updatedAt || null,
 lastError: calendarRecord?.lastError || null,
 };
}

function getEventEntityType(Calendar) {
 return Calendar?.EntityTypes?.EVENT || 'event';
}

function getPermissionStatus(response = {}) {
 return String(response?.status || '').toLowerCase();
}

export function isCalendarPermissionGranted(response = {}) {
 return response?.granted === true || getPermissionStatus(response) === 'granted';
}

async function requestCalendarWritePermission(Calendar) {
 if (!Calendar) {
 return {
 status: CALENDAR_RECORD_STATUS.UNAVAILABLE,
 granted: false,
 };
 }

 if (typeof Calendar.requestCalendarPermissions === 'function') {
 return Calendar.requestCalendarPermissions(true);
 }

 if (typeof Calendar.requestCalendarPermissionsAsync === 'function') {
 return Calendar.requestCalendarPermissionsAsync(true);
 }

 if (typeof Calendar.requestPermissionsAsync === 'function') {
 return Calendar.requestPermissionsAsync(true);
 }

 return {
 status: CALENDAR_RECORD_STATUS.UNAVAILABLE,
 granted: false,
 };
}

async function getDeviceCalendars(Calendar) {
 const entityType = getEventEntityType(Calendar);

 if (typeof Calendar.getCalendars === 'function') {
 const result = Calendar.getCalendars(entityType);
 return Array.isArray(result) ? result : await result;
 }

 if (typeof Calendar.getCalendarsAsync === 'function') {
 return Calendar.getCalendarsAsync(entityType);
 }

 return [];
}

export function isWritableCalendar(calendar = {}) {
 if (!calendar || !calendar.id) return false;
 if (calendar.allowsModifications === false) return false;
 return true;
}

function calendarScore(calendar = {}) {
 let score = 0;

 if (isWritableCalendar(calendar)) score += 100;
 if (calendar.isSynced === true) score += 40;
 if (calendar.isPrimary === true) score += 30;
 if (calendar.isVisible === true) score += 10;
 if (calendar.ownerAccount) score += 5;
 if (calendar.source?.name || calendar.source?.title) score += 5;

 const title = String(getCalendarDisplayTitle(calendar)).toLowerCase();
 if (title.includes('google') || title.includes('gmail')) score += 8;
 if (title.includes('samsung')) score += 6;
 if (title.includes('naver') || title.includes('네이버')) score += 4;

 return score;
}

export function getWritableCalendars(calendars = []) {
 return (Array.isArray(calendars) ? calendars : [])
 .filter(isWritableCalendar)
 .sort((a, b) => calendarScore(b) - calendarScore(a));
}

export function pickBestWritableCalendar(calendars = []) {
 const writable = getWritableCalendars(calendars);
 return writable[0] || null;
}

export function buildCalendarRecordSettings(calendar) {
 if (!calendar?.id) {
 return {
 enabled: false,
 status: CALENDAR_RECORD_STATUS.NO_WRITABLE_CALENDAR,
 selectedCalendarId: null,
 selectedCalendarTitle: null,
 writeMode: 'manual',
 updatedAt: new Date().toISOString(),
 lastError: '저장 가능한 캘린더를 찾지 못했습니다.',
 };
 }

 return {
 enabled: true,
 status: CALENDAR_RECORD_STATUS.CONNECTED,
 selectedCalendarId: calendar.id,
 selectedCalendarTitle: getCalendarDisplayTitle(calendar),
 writeMode: 'manual',
 updatedAt: new Date().toISOString(),
 lastError: null,
 };
}


export async function getWritableCalendarOptions() {
  const Calendar = getCalendarRecordModule();
  if (!Calendar) {
    return { ok: false, calendars: [], status: CALENDAR_RECORD_STATUS.UNAVAILABLE, message: '이 빌드에서 캘린더 모듈을 사용할 수 없습니다.' };
  }

  try {
    const permission = await requestCalendarWritePermission(Calendar);
    if (!isCalendarPermissionGranted(permission)) {
      return { ok: false, calendars: [], status: CALENDAR_RECORD_STATUS.PERMISSION_DENIED, message: '캘린더 권한이 허용되지 않았습니다.' };
    }

    const calendars = await getDeviceCalendars(Calendar);
    const writable = getWritableCalendars(calendars);

    if (!writable.length) {
      return { ok: false, calendars: [], status: CALENDAR_RECORD_STATUS.NO_WRITABLE_CALENDAR, message: '쓰기 가능한 캘린더가 없습니다.' };
    }

    return { ok: true, calendars: writable, status: CALENDAR_RECORD_STATUS.CONNECTED, message: null };
  } catch (error) {
    return { ok: false, calendars: [], status: CALENDAR_RECORD_STATUS.ERROR, message: error?.message || '캘린더 목록을 불러오는 중 오류가 발생했습니다.' };
  }
}

export async function prepareCalendarRecordConnection() {
 const Calendar = getCalendarRecordModule();

 if (!Calendar) {
 return {
 ok: false,
 status: CALENDAR_RECORD_STATUS.UNAVAILABLE,
 settings: {
 enabled: false,
 status: CALENDAR_RECORD_STATUS.UNAVAILABLE,
 selectedCalendarId: null,
 selectedCalendarTitle: null,
 writeMode: 'manual',
 updatedAt: new Date().toISOString(),
 lastError: '이 빌드에서 캘린더 모듈을 사용할 수 없습니다.',
 },
 calendars: [],
 selectedCalendar: null,
 error: '이 빌드에서 캘린더 모듈을 사용할 수 없습니다.',
 };
 }

 try {
 const permission = await requestCalendarWritePermission(Calendar);

 if (!isCalendarPermissionGranted(permission)) {
 return {
 ok: false,
 status: CALENDAR_RECORD_STATUS.PERMISSION_DENIED,
 settings: {
 enabled: false,
 status: CALENDAR_RECORD_STATUS.PERMISSION_DENIED,
 selectedCalendarId: null,
 selectedCalendarTitle: null,
 writeMode: 'manual',
 updatedAt: new Date().toISOString(),
 lastError: '캘린더 권한이 허용되지 않았습니다.',
 },
 calendars: [],
 selectedCalendar: null,
 permission,
 error: '캘린더 권한이 허용되지 않았습니다.',
 };
 }

 const calendars = await getDeviceCalendars(Calendar);
 const selectedCalendar = pickBestWritableCalendar(calendars);

 if (!selectedCalendar) {
 return {
 ok: false,
 status: CALENDAR_RECORD_STATUS.NO_WRITABLE_CALENDAR,
 settings: buildCalendarRecordSettings(null),
 calendars: Array.isArray(calendars) ? calendars : [],
 selectedCalendar: null,
 permission,
 error: '저장 가능한 캘린더를 찾지 못했습니다.',
 };
 }

 return {
 ok: true,
 status: CALENDAR_RECORD_STATUS.CONNECTED,
 settings: buildCalendarRecordSettings(selectedCalendar),
 calendars: Array.isArray(calendars) ? calendars : [],
 selectedCalendar,
 permission,
 error: null,
 };
 } catch (error) {
 return {
 ok: false,
 status: CALENDAR_RECORD_STATUS.ERROR,
 settings: {
 enabled: false,
 status: CALENDAR_RECORD_STATUS.ERROR,
 selectedCalendarId: null,
 selectedCalendarTitle: null,
 writeMode: 'manual',
 updatedAt: new Date().toISOString(),
 lastError: error?.message || '캘린더 연결 중 오류가 발생했습니다.',
 },
 calendars: [],
 selectedCalendar: null,
 error: error?.message || '캘린더 연결 중 오류가 발생했습니다.',
 };
 }
}

const CALENDAR_EVENT_NOT_FOUND_ERROR = '기존 캘린더 일정을 찾을 수 없습니다. 캘린더에서 삭제되었을 수 있습니다.';

async function updateCalendarEvent(Calendar, calendarEventId, draft) {
  if (typeof Calendar.updateEventAsync === 'function') {
    return Calendar.updateEventAsync(calendarEventId, draft);
  }

  if (typeof Calendar.updateEvent === 'function') {
    const result = Calendar.updateEvent(calendarEventId, draft);
    return result && typeof result.then === 'function' ? await result : result;
  }

  throw new Error('이 빌드에서 캘린더 이벤트 수정 기능을 사용할 수 없습니다.');
}

async function deleteCalendarEvent(Calendar, calendarEventId) {
  if (typeof Calendar.deleteEventAsync === 'function') {
    return Calendar.deleteEventAsync(calendarEventId);
  }

  if (typeof Calendar.deleteEvent === 'function') {
    const result = Calendar.deleteEvent(calendarEventId);
    return result && typeof result.then === 'function' ? await result : result;
  }

  throw new Error('이 빌드에서 캘린더 이벤트 삭제 기능을 사용할 수 없습니다.');
}

function getCalendarEventLookupRange({ entryDate, entry, draft } = {}) {
  const sourceDate = draft?.startDate || entryDate || entry?.timestamp || Date.now();
  const baseDate = new Date(sourceDate);
  const safeDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;

  const startDate = new Date(safeDate);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - 1);

  const endDate = new Date(safeDate);
  endDate.setHours(23, 59, 59, 999);
  endDate.setDate(endDate.getDate() + 1);

  return { startDate, endDate };
}

function isSameCalendarEventId(event, calendarEventId) {
  return String(event?.id || event?.eventId || '') === String(calendarEventId || '');
}

async function getCalendarEventById(Calendar, calendarEventId) {
  if (!calendarEventId) return null;

  try {
    if (typeof Calendar.getEventAsync === 'function') {
      const event = await Calendar.getEventAsync(calendarEventId);
      return event?.id || event?.eventId ? event : null;
    }

    if (typeof Calendar.getEvent === 'function') {
      const result = Calendar.getEvent(calendarEventId);
      const event = result && typeof result.then === 'function' ? await result : result;
      return event?.id || event?.eventId ? event : null;
    }
  } catch (error) {
    return null;
  }

  return null;
}

async function getCalendarEventsInRange(Calendar, calendarId, range) {
  if (!calendarId || !range?.startDate || !range?.endDate) return [];

  try {
    if (typeof Calendar.getEventsAsync === 'function') {
      const events = await Calendar.getEventsAsync([calendarId], range.startDate, range.endDate);
      return Array.isArray(events) ? events : [];
    }

    if (typeof Calendar.getEvents === 'function') {
      const result = Calendar.getEvents([calendarId], range.startDate, range.endDate);
      const events = result && typeof result.then === 'function' ? await result : result;
      return Array.isArray(events) ? events : [];
    }
  } catch (error) {
    return [];
  }

  return [];
}

async function findCalendarRecordEvent(Calendar, calendarId, calendarEventId, { entryDate, entry, draft } = {}) {
  const directEvent = await getCalendarEventById(Calendar, calendarEventId);
  if (directEvent && isSameCalendarEventId(directEvent, calendarEventId)) {
    return directEvent;
  }

  const range = getCalendarEventLookupRange({ entryDate, entry, draft });
  const events = await getCalendarEventsInRange(Calendar, calendarId, range);
  return events.find((event) => isSameCalendarEventId(event, calendarEventId)) || null;
}

export async function updateCalendarRecordEvent({
  calendarRecord,
  calendarEventId,
  challengeTitle,
  entry,
  entryDate,
  linkedRecords = [],
  draft,
} = {}) {
  const Calendar = getCalendarRecordModule();
  const settings = normalizeCalendarRecordSettings(calendarRecord);
  let eventDraft = draft || null;

  if (!calendarEventId) {
    return {
      ok: false,
      status: CALENDAR_RECORD_STATUS.ERROR,
      eventId: null,
      draft: eventDraft,
      shouldClearCalendarRecord: true,
      error: '수정할 캘린더 일정 ID가 없습니다.',
    };
  }

  if (!Calendar) {
    return {
      ok: false,
      status: CALENDAR_RECORD_STATUS.UNAVAILABLE,
      eventId: calendarEventId,
      draft: eventDraft,
      shouldClearCalendarRecord: false,
      error: '이 빌드에서 캘린더 모듈을 사용할 수 없습니다.',
    };
  }

  if (!isCalendarRecordLinked(settings)) {
    return {
      ok: false,
      status: CALENDAR_RECORD_STATUS.NOT_CONNECTED,
      eventId: calendarEventId,
      draft: eventDraft,
      shouldClearCalendarRecord: false,
      error: '캘린더 기록이 연결되어 있지 않습니다.',
    };
  }

  try {
    const permission = await requestCalendarWritePermission(Calendar);
    if (!isCalendarPermissionGranted(permission)) {
      return {
        ok: false,
        status: CALENDAR_RECORD_STATUS.PERMISSION_DENIED,
        eventId: calendarEventId,
        draft: eventDraft,
        permission,
        shouldClearCalendarRecord: false,
        error: '캘린더 권한이 허용되지 않았습니다.',
      };
    }

    eventDraft = eventDraft || buildCalendarEventDraft({
      challengeTitle,
      entry,
      entryDate,
      linkedRecords,
    });

    const existingEvent = await findCalendarRecordEvent(Calendar, settings.selectedCalendarId, calendarEventId, {
      entryDate,
      entry,
      draft: eventDraft,
    });

    if (!existingEvent) {
      return {
        ok: false,
        status: CALENDAR_RECORD_STATUS.ERROR,
        eventId: calendarEventId,
        draft: eventDraft,
        shouldClearCalendarRecord: true,
        error: CALENDAR_EVENT_NOT_FOUND_ERROR,
      };
    }

    await updateCalendarEvent(Calendar, calendarEventId, eventDraft);

    const confirmedEvent = await findCalendarRecordEvent(Calendar, settings.selectedCalendarId, calendarEventId, {
      entryDate,
      entry,
      draft: eventDraft,
    });

    if (!confirmedEvent) {
      return {
        ok: false,
        status: CALENDAR_RECORD_STATUS.ERROR,
        eventId: calendarEventId,
        draft: eventDraft,
        shouldClearCalendarRecord: true,
        error: CALENDAR_EVENT_NOT_FOUND_ERROR,
      };
    }

    return {
      ok: true,
      status: CALENDAR_RECORD_STATUS.CONNECTED,
      eventId: calendarEventId,
      draft: eventDraft,
      shouldClearCalendarRecord: false,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: CALENDAR_RECORD_STATUS.ERROR,
      eventId: calendarEventId,
      draft: eventDraft,
      shouldClearCalendarRecord: false,
      error: error?.message || '캘린더 일정을 수정하는 중 오류가 발생했습니다.',
    };
  }
}

export async function deleteCalendarRecordEvent({
  calendarRecord,
  calendarEventId,
  entry,
  entryDate,
} = {}) {
  const Calendar = getCalendarRecordModule();
  const settings = normalizeCalendarRecordSettings(calendarRecord);

  if (!calendarEventId) {
    return {
      ok: true,
      status: CALENDAR_RECORD_STATUS.CONNECTED,
      eventId: null,
      alreadyMissing: true,
      shouldClearCalendarRecord: true,
      error: null,
    };
  }

  if (!Calendar) {
    return {
      ok: false,
      status: CALENDAR_RECORD_STATUS.UNAVAILABLE,
      eventId: calendarEventId,
      alreadyMissing: false,
      shouldClearCalendarRecord: false,
      error: '이 빌드에서 캘린더 모듈을 사용할 수 없습니다.',
    };
  }

  if (!isCalendarRecordLinked(settings)) {
    return {
      ok: false,
      status: CALENDAR_RECORD_STATUS.NOT_CONNECTED,
      eventId: calendarEventId,
      alreadyMissing: false,
      shouldClearCalendarRecord: false,
      error: '캘린더 기록이 연결되어 있지 않습니다.',
    };
  }

  try {
    const permission = await requestCalendarWritePermission(Calendar);
    if (!isCalendarPermissionGranted(permission)) {
      return {
        ok: false,
        status: CALENDAR_RECORD_STATUS.PERMISSION_DENIED,
        eventId: calendarEventId,
        permission,
        alreadyMissing: false,
        shouldClearCalendarRecord: false,
        error: '캘린더 권한이 허용되지 않았습니다.',
      };
    }

    const existingEvent = await findCalendarRecordEvent(Calendar, settings.selectedCalendarId, calendarEventId, {
      entryDate,
      entry,
    });

    if (!existingEvent) {
      return {
        ok: true,
        status: CALENDAR_RECORD_STATUS.CONNECTED,
        eventId: calendarEventId,
        alreadyMissing: true,
        shouldClearCalendarRecord: true,
        error: null,
      };
    }

    await deleteCalendarEvent(Calendar, calendarEventId);

    const confirmedEvent = await findCalendarRecordEvent(Calendar, settings.selectedCalendarId, calendarEventId, {
      entryDate,
      entry,
    });

    if (confirmedEvent) {
      return {
        ok: false,
        status: CALENDAR_RECORD_STATUS.ERROR,
        eventId: calendarEventId,
        alreadyMissing: false,
        shouldClearCalendarRecord: false,
        error: '캘린더 일정을 삭제하지 못했습니다.',
      };
    }

    return {
      ok: true,
      status: CALENDAR_RECORD_STATUS.CONNECTED,
      eventId: calendarEventId,
      alreadyMissing: false,
      shouldClearCalendarRecord: true,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: CALENDAR_RECORD_STATUS.ERROR,
      eventId: calendarEventId,
      alreadyMissing: false,
      shouldClearCalendarRecord: false,
      error: error?.message || '캘린더 일정을 삭제하는 중 오류가 발생했습니다.',
    };
  }
}
export function buildCalendarEventDraft({
 challengeTitle,
 entry,
 entryDate,
 linkedRecords = [],
} = {}) {
 const baseDate = entryDate ? new Date(entryDate) : new Date(entry?.timestamp || Date.now());
 const startDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
 const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
 const safeTitle = challengeTitle || '도전';

 const notes = [
  '도전: ' + safeTitle,
  entry?.duration ? '소요 시간: ' + entry.duration + '분' : null,
  entry?.text ? '인증 내용: ' + entry.text : null,
  linkedRecords.length
   ? '건강 데이터: ' + linkedRecords.map((record) => record?.displayText || record?.label).filter(Boolean).join(' / ')
   : null,
  'THE PUSH에서 기록됨',
 ].filter(Boolean).join('\n');

 return {
  title: 'THE PUSH 인증 완료 - ' + safeTitle,
  notes,
  startDate,
  endDate,
  timeZone: Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || undefined,
 };
}

async function createCalendarEvent(Calendar, calendarId, draft) {
  if (typeof Calendar.createEventAsync === 'function') {
    return Calendar.createEventAsync(calendarId, draft);
  }

  if (typeof Calendar.createEvent === 'function') {
    const result = Calendar.createEvent(calendarId, draft);
    return result && typeof result.then === 'function' ? await result : result;
  }

  throw new Error('이 빌드에서 캘린더 이벤트 생성 기능을 사용할 수 없습니다.');
}

export async function createCalendarRecordEvent({
  calendarRecord,
  challengeTitle,
  entry,
  entryDate,
  linkedRecords = [],
  draft,
} = {}) {
  const Calendar = getCalendarRecordModule();
  const settings = normalizeCalendarRecordSettings(calendarRecord);

  if (!Calendar) {
    return {
      ok: false,
      status: CALENDAR_RECORD_STATUS.UNAVAILABLE,
      eventId: null,
      draft: draft || null,
      selectedCalendar: null,
      error: '이 빌드에서 캘린더 모듈을 사용할 수 없습니다.',
    };
  }

  if (!isCalendarRecordLinked(settings) || !settings.selectedCalendarId) {
    return {
      ok: false,
      status: CALENDAR_RECORD_STATUS.NOT_CONNECTED,
      eventId: null,
      draft: draft || null,
      selectedCalendar: null,
      error: '캘린더 기록이 연결되어 있지 않습니다.',
    };
  }

  let eventDraft = draft || null;

  try {
    const permission = await requestCalendarWritePermission(Calendar);
    if (!isCalendarPermissionGranted(permission)) {
      return {
        ok: false,
        status: CALENDAR_RECORD_STATUS.PERMISSION_DENIED,
        eventId: null,
        draft: eventDraft,
        selectedCalendar: null,
        permission,
        error: '캘린더 권한이 허용되지 않았습니다.',
      };
    }

    const calendars = await getDeviceCalendars(Calendar);
    const selectedCalendar = (Array.isArray(calendars) ? calendars : []).find((calendar) => {
      return String(calendar?.id) === String(settings.selectedCalendarId);
    });

    if (!selectedCalendar || !isWritableCalendar(selectedCalendar)) {
      return {
        ok: false,
        status: CALENDAR_RECORD_STATUS.NO_WRITABLE_CALENDAR,
        eventId: null,
        draft: eventDraft,
        selectedCalendar: selectedCalendar || null,
        error: '선택한 캘린더에 기록할 수 없습니다. 설정 > 데이터 출처 관리에서 캘린더를 다시 선택해주세요.',
      };
    }

    eventDraft = eventDraft || buildCalendarEventDraft({
      challengeTitle,
      entry,
      entryDate,
      linkedRecords,
    });

    const eventId = await createCalendarEvent(Calendar, settings.selectedCalendarId, eventDraft);

    return {
      ok: true,
      status: CALENDAR_RECORD_STATUS.CONNECTED,
      eventId: eventId || null,
      draft: eventDraft,
      selectedCalendar,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: CALENDAR_RECORD_STATUS.ERROR,
      eventId: null,
      draft: eventDraft,
      selectedCalendar: null,
      error: error?.message || '캘린더에 인증 기록을 저장하는 중 오류가 발생했습니다.',
    };
  }
}
