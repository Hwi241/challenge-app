const toFiniteNumber = (value, fallback = 0) => {
 const numeric = Number(value);
 return Number.isFinite(numeric) ? numeric : fallback;
};

const getStoredPosition = (item, index) => ({
 y: Math.max(0, toFiniteNumber(item?.y, index)),
 x: Math.max(0, toFiniteNumber(item?.x, 0)),
 index,
});

export const sortDashboardCardsByStoredPosition = (items = []) => {
 const source = Array.isArray(items) ? items : [];

 return source
 .map((item, index) => ({
 item,
 position: getStoredPosition(item, index),
 }))
 .sort((a, b) => {
 if (a.position.y !== b.position.y) {
 return a.position.y - b.position.y;
 }

 if (a.position.x !== b.position.x) {
 return a.position.x - b.position.x;
 }

 return a.position.index - b.position.index;
 })
 .map(({ item }) => ({ ...item }));
};

export const buildResponsiveDashboardLayout = (
 items = [],
 {
 columns = 6,
 maxCardWidth = 6,
 } = {},
) => {
 const safeColumns = Math.max(
 1,
 Math.floor(toFiniteNumber(columns, 6)),
 );

 const safeMaxCardWidth = Math.max(
 1,
 Math.min(
 safeColumns,
 Math.floor(toFiniteNumber(maxCardWidth, 6)),
 ),
 );

 const orderedCards =
 sortDashboardCardsByStoredPosition(items);

 const occupiedCells = new Set();
 let nextMinimumCellIndex = 0;

 const getCellKey = (x, y) => `${x}:${y}`;

 const canPlaceCard = ({ x, y, w, h }) => {
 if (
 x < 0 ||
 y < 0 ||
 x + w > safeColumns
 ) {
 return false;
 }

 for (
 let row = y;
 row < y + h;
 row += 1
 ) {
 for (
 let column = x;
 column < x + w;
 column += 1
 ) {
 if (
 occupiedCells.has(
 getCellKey(column, row),
 )
 ) {
 return false;
 }
 }
 }

 return true;
 };

 const occupyCardCells = ({ x, y, w, h }) => {
 for (
 let row = y;
 row < y + h;
 row += 1
 ) {
 for (
 let column = x;
 column < x + w;
 column += 1
 ) {
 occupiedCells.add(
 getCellKey(column, row),
 );
 }
 }
 };

 return orderedCards.map((card) => {
 const safeW = Math.max(
 1,
 Math.min(
 safeMaxCardWidth,
 Math.floor(
 toFiniteNumber(
 card?.w,
 safeMaxCardWidth,
 ),
 ),
 ),
 );

 const safeH = Math.max(
 1,
 Math.floor(
 toFiniteNumber(card?.h, 1),
 ),
 );

 let candidateCellIndex = Math.max(
 0,
 nextMinimumCellIndex,
 );

 let placedFrame = null;

 while (!placedFrame) {
 const candidateY = Math.floor(
 candidateCellIndex / safeColumns,
 );

 const candidateX =
 candidateCellIndex % safeColumns;

 const candidateFrame = {
 x: candidateX,
 y: candidateY,
 w: safeW,
 h: safeH,
 };

 if (canPlaceCard(candidateFrame)) {
 placedFrame = candidateFrame;
 break;
 }

 candidateCellIndex += 1;
 }

 occupyCardCells(placedFrame);

 nextMinimumCellIndex =
 placedFrame.y * safeColumns +
 placedFrame.x +
 1;

 return {
 ...card,
 x: placedFrame.x,
 y:placedFrame.y,
 w: placedFrame.w,
 h: placedFrame.h,
 };
 });
};

const getDashboardCardIdentity = (item) => String(
 item?.widgetId ??
 item?.id ??
 item?.i ??
 '',
);

export const buildDashboardLayoutFromOrder = (
 items = [],
 {
 columns = 6,
 maxCardWidth = 6,
 } = {},
) => {
 const source = Array.isArray(items)
 ? items
 : [];

 const orderedSeeds = source.map(
 (item, index) => ({
 ...item,
 x: 0,
 y: index,
 __dashboardOrderIndex: index,
 }),
 );

 return buildResponsiveDashboardLayout(
 orderedSeeds,
 {
 columns,
 maxCardWidth,
 },
 ).map((item) => {
 const {
 __dashboardOrderIndex,
 ...cleanItem
 } = item;

 return cleanItem;
 });
};

export const reorderDashboardCardsByInsertion = (
 items = [],
 movingId,
 insertionIndex,
 {
 columns = 6,
 maxCardWidth = 6,
 } = {},
) => {
 const movingIdentity = String(
 movingId ?? '',
 );

 const orderedCards =
 sortDashboardCardsByStoredPosition(items);

 if (!movingIdentity) {
 return orderedCards;
 }

 const movingIndex = orderedCards.findIndex(
 (item) => (
 getDashboardCardIdentity(item) ===
 movingIdentity
 ),
 );

 if (movingIndex < 0) {
 return orderedCards;
 }

 const remainingCards = orderedCards.map(
 (item) => ({ ...item }),
 );

 const [movingCard] = remainingCards.splice(
 movingIndex,
 1,
 );

 const safeInsertionIndex = Math.max(
 0,
 Math.min(
 remainingCards.length,
 Math.floor(
 toFiniteNumber(
 insertionIndex,
 movingIndex,
 ),
 ),
 ),
 );

 remainingCards.splice(
 safeInsertionIndex,
 0,
 movingCard,
 );

 return buildDashboardLayoutFromOrder(
 remainingCards,
 {
 columns,
 maxCardWidth,
 },
 );
};
