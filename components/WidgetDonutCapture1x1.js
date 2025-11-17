import React, { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system';
import { writeDonut1x1Image } from '../utils/widgetSnapshot';
import Svg, { Circle, G } from 'react-native-svg';

/**
 * 위젯 1×1 도넛 캡처 (기본 렌더러 내장)
 * - 원하는 모양(예시 이미지)로 고정:
 *    · 두꺼운 외곽 링(트랙) + 라운드 캡 진행 링
 *    · 중앙 블랙 디스크 작게
 *    · 퍼센트 글자 크게(굵게)
 * - progressPct: 0~100
 * - 필요 시 renderDonut(size)로 앱의 커스텀 렌더러를 넘기면 그걸 사용(없으면 기본)
 */
export default function WidgetDonutCapture1x1({
  challengeId,
  progressPct = 0,
  deps = [],
  renderDonut,           // (size) => ReactNode (넘기면 그걸 사용)
  size = 380,            // 캡처 해상도
  safePaddingRatio = 0.10,  // 테두리 클리핑 방지용 여백(10%)
  trackColor = '#E6E9EE',   // 연한 회색 트랙
  progressColor = '#111111',
  centerColor = '#111111',
  textColor = '#FFFFFF',
  titleForCache,
}) {
  const ref = useRef(null);

  // ----- 기본 도넛 렌더러(예시 이미지와 동일 비율) -----
  const DefaultDonut = () => {
    const pad = size * safePaddingRatio;              // 외곽 여백
    const R = size / 2;                               // 전체 반지름
    const ringR = R - pad;                            // 링 중심 반지름
    const strokeW = size * 0.18;                      // 링 두께(=지름의 18%)
    const innerR = ringR - strokeW * 0.95;            // 중앙 디스크 반지름(작게)
    const C = 2 * Math.PI * ringR;                    // 원 둘레
    const pct = Math.max(0, Math.min(100, progressPct));
    const dash = C * (pct / 100);

    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation="-90" origin={`${R}, ${R}`}>
          {/* 트랙 */}
          <Circle
            cx={R}
            cy={R}
            r={ringR}
            stroke={trackColor}
            strokeWidth={strokeW}
            fill="none"
          />
          {/* 진행(라운드 캡) */}
          <Circle
            cx={R}
            cy={R}
            r={ringR}
            stroke={progressColor}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${dash}, ${C}`}
            fill="none"
          />
        </G>

        {/* 중앙 디스크 */}
        <Circle cx={R} cy={R} r={innerR} fill={centerColor} />

        {/* 퍼센트 텍스트(크게, 굵게) */}
        <Text
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            textAlign: 'center',
            textAlignVertical: 'center',
            fontSize: Math.round(size * 0.26), // 크게
            fontWeight: '800',
            color: textColor,
          }}
        >
          {`${Math.round(pct)}%`}
        </Text>
      </Svg>
    );
  };

  // ----- 캡처 -----
  useEffect(() => {
    let mounted = true;
    (async () => {
      // 뷰 레이아웃 안정화 대기
      await new Promise(r => setTimeout(r, 60));
      if (!mounted || !ref.current || !challengeId) return;
      try {
        const uri = await captureRef(ref, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          width: size,
          height: size,
        });
        await writeDonut1x1Image(challengeId, uri, { title: titleForCache });
        try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
      } catch (e) {
        console.warn('[WidgetDonutCapture1x1] capture fail:', e?.message || e);
      }
    })();
    return () => { mounted = false; };
  }, deps);

  return (
    <View style={{ position: 'absolute', left: -9999, top: -9999, width: size, height: size, opacity: 0 }}>
      <View
        ref={ref}
        collapsable={false}
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
          padding: 0,
        }}
      >
        {typeof renderDonut === 'function' ? renderDonut(size) : <DefaultDonut />}
      </View>
    </View>
  );
}
