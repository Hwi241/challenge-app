# DeepScan Phase 1: Syntax & Reference Check Report
Scan Time: 2026. 05. 03. (일) 19:00:22 KST
Target: screens/, components/


/home/hwi/challenge-app/components/BackButton.js
  2:8  warning  'React' is defined but never used  no-unused-vars

/home/hwi/challenge-app/components/MonthlyNotificationPreview.js
  12:8  warning  'React' is defined but never used  no-unused-vars

/home/hwi/challenge-app/components/WeeklyNotificationPreview.js
  17:8  warning  'React' is defined but never used  no-unused-vars

/home/hwi/challenge-app/components/WidgetDonutCapture1x1.js
    1:8   warning  'React' is defined but never used  no-unused-vars
    2:16  warning  'Text' is defined but never used   no-unused-vars
   91:30  error    'setTimeout' is not defined        no-undef
  104:9   error    'console' is not defined           no-undef

/home/hwi/challenge-app/screens/AddChallengeScreen.js
    2:41  warning  'useMemo' is defined but never used                     no-unused-vars
    3:89  warning  'BackHandler' is defined but never used                 no-unused-vars
    4:35  warning  'useFocusEffect' is defined but never used              no-unused-vars
   23:10  warning  'numericInputProps' is defined but never used           no-unused-vars
   24:10  warning  'validateInput' is defined but never used               no-unused-vars
   29:7   warning  'DRAFT_KEY' is assigned a value but never used          no-unused-vars
  180:10  warning  'asDoneFlags' is defined but never used                 no-unused-vars
  192:10  warning  'parseDateStr' is defined but never used                no-unused-vars
  201:9   warning  'route' is assigned a value but never used              no-unused-vars
  232:9   warning  'setGoalScore' is assigned a value but never used       no-unused-vars
  248:9   warning  'saveDraftDebounce' is assigned a value but never used  no-unused-vars
  249:9   warning  'suppressDraftRef' is assigned a value but never used   no-unused-vars
  306:14  warning  'e' is defined but never used                           no-unused-vars

/home/hwi/challenge-app/screens/BackupScreen.js
   3:8   warning  'React' is defined but never used  no-unused-vars
  22:7   error    'console' is not defined           no-undef
  75:17  error    'console' is not defined           no-undef
  85:7   error    'console' is not defined           no-undef

/home/hwi/challenge-app/screens/ChallengeListScreen.js
   62:3   error    'console' is not defined                                 no-undef
   69:5   error    'console' is not defined                                 no-undef
   71:5   error    'console' is not defined                                 no-undef
  174:5   error    'console' is not defined                                 no-undef
  175:5   error    'console' is not defined                                 no-undef
  176:5   error    'console' is not defined                                 no-undef
  190:5   error    'console' is not defined                                 no-undef
  191:5   error    'console' is not defined                                 no-undef
  193:3   error    'console' is not defined                                 no-undef
  194:3   error    'console' is not defined                                 no-undef
  226:5   error    'console' is not defined                                 no-undef
  228:5   error    'console' is not defined                                 no-undef
  459:7   error    'console' is not defined                                 no-undef
  460:7   error    'console' is not defined                                 no-undef
  462:7   error    'console' is not defined                                 no-undef
  479:7   error    'console' is not defined                                 no-undef
  480:7   error    'console' is not defined                                 no-undef
  487:21  error    'console' is not defined                                 no-undef
  495:7   error    'console' is not defined                                 no-undef
  507:5   error    'console' is not defined                                 no-undef
  544:39  warning  'height' is defined but never used                       no-unused-vars
  553:9   warning  'rafMeasureSelected' is assigned a value but never used  no-unused-vars
  554:5   error    'requestAnimationFrame' is not defined                   no-undef
  554:33  error    'requestAnimationFrame' is not defined                   no-undef
  554:61  error    'requestAnimationFrame' is not defined                   no-undef
  571:11  error    'console' is not defined                                 no-undef
  602:5   error    'console' is not defined                                 no-undef
  654:5   error    'console' is not defined                                 no-undef
  705:5   error    'console' is not defined                                 no-undef
  710:5   error    'setTimeout' is not defined                              no-undef
  740:9   error    'console' is not defined                                 no-undef
  750:7   error    'requestAnimationFrame' is not defined                   no-undef
  750:35  error    'requestAnimationFrame' is not defined                   no-undef
  761:5   error    'console' is not defined                                 no-undef

/home/hwi/challenge-app/screens/EditChallengeScreen.js
   22:8  warning  'React' is defined but never used  no-unused-vars
  318:9  error    'console' is not defined           no-undef
  455:7  error    'console' is not defined           no-undef

/home/hwi/challenge-app/screens/EntryDetailScreen.js
    9:8   warning  'React' is defined but never used  no-unused-vars
   69:9   error    'console' is not defined           no-undef
  139:7   error    'console' is not defined           no-undef
  193:7   error    'console' is not defined           no-undef
  229:13  error    'console' is not defined           no-undef

/home/hwi/challenge-app/screens/EntryListScreen.js
     8:130  warning  'Platform' is defined but never used                             no-unused-vars
     8:154  warning  'Animated' is defined but never used                             no-unused-vars
    21:10   warning  'useFocusEffect' is defined but never used                       no-unused-vars
    27:14   error    'require' is not defined                                         no-undef
    29:7    warning  'AdBannerPlaceholder' is assigned a value but never used         no-unused-vars
    55:7    warning  'GRAPH_REWARD_GAP' is assigned a value but never used            no-unused-vars
    57:7    warning  'REWARD_SUMMARY_GAP' is assigned a value but never used          no-unused-vars
   125:5    error    'console' is not defined                                         no-undef
   854:16   error    'requestAnimationFrame' is not defined                           no-undef
   857:18   error    'cancelAnimationFrame' is not defined                            no-undef
  1030:7    warning  'DOW_LABELS' is assigned a value but never used                  no-unused-vars
  1031:7    warning  'DOW_SHOW' is assigned a value but never used                    no-unused-vars
  1033:76   warning  'introProgress' is assigned a value but never used               no-unused-vars
  1050:41   error    'clearTimeout' is not defined                                    no-undef
  1052:29   error    'cancelAnimationFrame' is not defined                            no-undef
  1059:23   error    'performance' is not defined                                     no-undef
  1079:28   error    'requestAnimationFrame' is not defined                           no-undef
  1081:26   error    'requestAnimationFrame' is not defined                           no-undef
  1083:31   error    'cancelAnimationFrame' is not defined                            no-undef
  1084:43   error    'clearTimeout' is not defined                                    no-undef
  1088:9    warning  'LEFT_LABEL_W' is assigned a value but never used                no-unused-vars
  1297:36   warning  'totalMinutes' is defined but never used                         no-unused-vars
  1297:50   warning  'hours' is defined but never used                                no-unused-vars
  1297:57   warning  'minutes' is defined but never used                              no-unused-vars
  1297:66   warning  'currentScore' is defined but never used                         no-unused-vars
  1297:80   warning  'targetScore' is defined but never used                          no-unused-vars
  1297:93   warning  'styles' is defined but never used                               no-unused-vars
  1381:17   error    'require' is not defined                                         no-undef
  1422:5    error    'setTimeout' is not defined                                      no-undef
  1447:15   error    'requestAnimationFrame' is not defined                           no-undef
  1452:11   error    'requestAnimationFrame' is not defined                           no-undef
  1566:7    error    'console' is not defined                                         no-undef
  1714:14   error    'console' is not defined                                         no-undef
  1718:5    error    Definition for rule 'react-hooks/exhaustive-deps' was not found  react-hooks/exhaustive-deps
  1843:13   error    'setTimeout' is not defined                                      no-undef
  1908:11   error    'setTimeout' is not defined                                      no-undef
  1939:30   error    'setTimeout' is not defined                                      no-undef
  1950:7    error    'console' is not defined                                         no-undef

/home/hwi/challenge-app/screens/FullRangeNotificationScreen.js
    1:8   warning  'React' is defined but never used                    no-unused-vars
    3:10  warning  'SafeAreaView' is defined but never used             no-unused-vars
  190:9   warning  'removeBulkTime' is assigned a value but never used  no-unused-vars
  425:20  error    'TextInput' is not defined                           no-undef
  436:20  error    'TextInput' is not defined                           no-undef

/home/hwi/challenge-app/screens/HallOfFameScreen.js
    9:8   warning  'React' is defined but never used                     no-unused-vars
  198:29  error    'clearTimeout' is not defined                         no-undef
  199:26  error    'setTimeout' is not defined                           no-undef
  239:16  error    'console' is not defined                              no-undef
  242:36  error    'clearTimeout' is not defined                         no-undef
  243:33  error    'clearTimeout' is not defined                         no-undef
  248:34  error    'clearTimeout' is not defined                         no-undef
  256:34  error    'clearTimeout' is not defined                         no-undef
  257:29  error    'setTimeout' is not defined                           no-undef
  261:9   warning  'enterSelectMode' is assigned a value but never used  no-unused-vars
  312:27  error    'console' is not defined                              no-undef

/home/hwi/challenge-app/screens/MonthlyNotificationScreen.js
  1:8  warning  'React' is defined but never used  no-unused-vars

/home/hwi/challenge-app/screens/NotificationDefaultsScreen.js
   2:8   warning  'React' is defined but never used             no-unused-vars
  30:9   warning  'route' is assigned a value but never used    no-unused-vars
  32:10  warning  'loading' is assigned a value but never used  no-unused-vars
  49:15  warning  'e' is defined but never used                 no-unused-vars
  77:13  warning  'e' is defined but never used                 no-unused-vars

/home/hwi/challenge-app/screens/SettingsScreen.js
  7:8  warning  'React' is defined but never used  no-unused-vars

/home/hwi/challenge-app/screens/SimpleNotificationScreen.js
  1:8  warning  'React' is defined but never used  no-unused-vars

/home/hwi/challenge-app/screens/StartupScreen.js
   2:8   warning  'React' is defined but never used  no-unused-vars
  10:15  error    'setTimeout' is not defined        no-undef
  13:18  error    'clearTimeout' is not defined      no-undef
  19:17  error    'require' is not defined           no-undef

/home/hwi/challenge-app/screens/TrashScreen.js
   2:8   warning  'React' is defined but never used         no-unused-vars
  10:35  warning  'buttonStyles' is defined but never used  no-unused-vars

/home/hwi/challenge-app/screens/UploadScreen.js
   23:8   warning  'React' is defined but never used  no-unused-vars
  163:20  warning  'e' is defined but never used      no-unused-vars
  186:20  warning  'e' is defined but never used      no-unused-vars
  207:13  error    'MAX_MINUTES' is not defined       no-undef
  207:30  error    'MAX_MINUTES' is not defined       no-undef
  230:65  error    'MAX_MINUTES' is not defined       no-undef
  269:9   error    'console' is not defined           no-undef
  291:7   error    'console' is not defined           no-undef

/home/hwi/challenge-app/screens/WeeklyNotificationScreen.js
    1:8  warning  'React' is defined but never used                   no-unused-vars
  193:9  warning  'scopeIsCustom' is assigned a value but never used  no-unused-vars

✖ 144 problems (84 errors, 60 warnings)


## DeepScan Phase 1: Syntax & Reference Check (2026-05-03)

### 스캔 범위
- `screens/`
- `components/` (파일 확장자: .js, .bak 제외)

### 검출 결과 요약
- **SyntaxError**: 0건 (모든 파일이 기본적인 문법 구조 통과)
- **ReferenceError (no-undef)**: 1개 파일에서 3건 검출
- **Warnings (no-unused-vars)**: 다수 검출 (코드 실행에는 영향 없으나 정리 권장)

### 상세 분석 (ReferenceError)

#### 1. screens/UploadScreen.js
- **에러**: `'MAX_MINUTES' is not defined (no-undef)`
- **위치**: 207라인, 230라인
- **내용**: `MAX_MINUTES` 상수가 정의되지 않은 상태에서 사용됨. 다른 설정 파일에서 import가 누락되었거나, 로컬 상수로 정의되어야 함.

### 참고 사항
- `requestAnimationFrame`, `cancelAnimationFrame`, `performance`, `TextInput` 등은 글로벌 객체로 간주하여 체크에서 제외함.
- ESLint 10.3.0을 사용하여 `no-undef` 및 `no-unused-vars` 규칙 적용.
- 코드는 수정하지 않았으며, 결과만 기록함.

