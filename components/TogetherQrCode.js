import React, { memo, useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

const QRCodeCore = require('qrcode/lib/core/qrcode.js');
const DEFAULT_QUIET_ZONE = 4;

const buildQrPath = (data, moduleCount, quietZone) => {
  let path = '';
  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      const index = row * moduleCount + column;
      if (!data[index]) continue;
      const x = column + quietZone;
      const y = row + quietZone;
      path += `M${x} ${y}` + 'h1v1h-1z';
    }
  }
  return path;
};

const TogetherQrCode = memo(function TogetherQrCode({
  value,
  size = 210,
  color = '#000000',
  backgroundColor = '#FFFFFF',
  errorCorrectionLevel = 'M',
  quietZone = DEFAULT_QUIET_ZONE,
}) {
  const qrData = useMemo(() => {
    const text = String(value ?? '');
    if (!text) return null;
    const result = QRCodeCore.create(text, { errorCorrectionLevel });
    const moduleCount = Number(result?.modules?.size);
    const sourceData = result?.modules?.data;
    if (!Number.isFinite(moduleCount) || moduleCount <= 0 || !sourceData) return null;
    const data = Array.from(sourceData);
    return {
      moduleCount,
      path: buildQrPath(data, moduleCount, quietZone),
    };
  }, [errorCorrectionLevel, quietZone, value]);

  if (!qrData) return null;
  const totalModules = qrData.moduleCount + quietZone * 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${totalModules} ${totalModules}`}>
      <Rect x={0} y={0} width={totalModules} height={totalModules} fill={backgroundColor} />
      <Path d={qrData.path} fill={color} />
    </Svg>
  );
});

export default TogetherQrCode;
