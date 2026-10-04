// Furniture store catalogue.
// Dimensions are in metres: w = width (along the front), d = depth, h = height.
// `elev` lifts wall-mounted items off the floor. `wallSnap` lets the item back
// itself against the nearest wall when placed or dragged.
// Prices are indicative Indian retail figures (INR) for budgeting only.

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'living', label: 'Living' },
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'dining', label: 'Dining' },
  { id: 'bath', label: 'Bath & utility' },
  { id: 'office', label: 'Study' },
  { id: 'decor', label: 'Pooja & decor' },
];

const WOOD = ['#8E6A48', '#5B3A24', '#C49A6C', '#E8E3D8'];
const FABRIC = ['#5F7484', '#8B6F5A', '#7E9170', '#B8B2A7', '#7C5A86'];
const KITCHEN = ['#E8E3D8', '#2F4F5A', '#8E6A48', '#7A2E2E', '#3A3F45'];
const WHITE = ['#F2F2F0'];

const P = (sku, name, category, model, w, d, h, price, colors, extra = {}) => ({
  sku, name, category, model, w, d, h, price, colors,
  wallSnap: true, elev: 0, params: {}, tags: [], ...extra,
});

export const CATALOG = [
  // Living
  P('LV-SOFA-3', 'Sofa, 3-seater', 'living', 'sofa', 2.1, 0.9, 0.85, 32000, FABRIC, { params: { seats: 3 }, tags: ['couch'] }),
  P('LV-SOFA-2', 'Sofa, 2-seater', 'living', 'sofa', 1.6, 0.9, 0.85, 24000, FABRIC, { params: { seats: 2 }, tags: ['couch'] }),
  P('LV-SOFA-L', 'L-shaped sofa', 'living', 'lsofa', 2.6, 1.7, 0.85, 58000, FABRIC, { tags: ['couch', 'sectional'] }),
  P('LV-ARM', 'Armchair', 'living', 'sofa', 0.85, 0.85, 0.85, 12500, FABRIC, { params: { seats: 1 }, wallSnap: false }),
  P('LV-RECL', 'Recliner', 'living', 'recliner', 0.95, 1.0, 1.0, 27000, ['#4A3B32', '#5F7484', '#2E2F31'], { wallSnap: false }),
  P('LV-COFFEE', 'Coffee table', 'living', 'table', 1.1, 0.6, 0.42, 8500, WOOD, { wallSnap: false, params: { shelf: true } }),
  P('LV-SIDE', 'Side table', 'living', 'table', 0.45, 0.45, 0.55, 3200, WOOD, { wallSnap: false, params: { round: true } }),
  P('LV-TV-18', 'TV unit, 1.8 m', 'living', 'tvUnit', 1.8, 0.42, 0.45, 15000, ['#3A3F45', ...WOOD]),
  P('LV-TV-PANEL', 'TV unit with wall panel', 'living', 'tvUnit', 2.4, 0.45, 2.2, 38000, WOOD, { params: { panel: true } }),
  P('LV-SHELF', 'Bookshelf', 'living', 'shelf', 0.9, 0.35, 1.9, 9800, WOOD),
  P('LV-RUG', 'Rug, 2 × 1.4 m', 'living', 'rug', 2.0, 1.4, 0.01, 6500, ['#A8603F', '#4F6B7A', '#C9B48F', '#7C5A86'], { wallSnap: false }),
  P('LV-LAMP', 'Floor lamp', 'living', 'lamp', 0.4, 0.4, 1.6, 4200, ['#2E2F31', '#C8963F'], { wallSnap: false }),
  P('LV-JHULA', 'Swing (jhula)', 'living', 'swing', 1.4, 0.8, 2.2, 22000, ['#8E6A48', '#5B3A24'], { wallSnap: false, tags: ['oonjal', 'jhoola'] }),

  // Bedroom
  P('BD-KING', 'King bed, 6 × 6½ ft', 'bedroom', 'bed', 1.83, 2.08, 1.0, 42000, ['#8E6A48', '#5F7484', '#B9C2CC', '#3A3F45'], { params: { pillows: 2 } }),
  P('BD-QUEEN', 'Queen bed, 5 × 6½ ft', 'bedroom', 'bed', 1.52, 2.08, 1.0, 32000, ['#8E6A48', '#5F7484', '#B9C2CC', '#3A3F45'], { params: { pillows: 2 } }),
  P('BD-SINGLE', 'Single bed, 3 × 6½ ft', 'bedroom', 'bed', 0.91, 2.04, 0.9, 15000, ['#8E6A48', '#5F7484', '#C27D4E'], { params: { pillows: 1 } }),
  P('BD-BUNK', 'Bunk bed', 'bedroom', 'bunk', 1.0, 2.05, 1.65, 28000, ['#5F7484', '#C27D4E', '#7E9170'], { tags: ['kids'] }),
  P('BD-NIGHT', 'Bedside table', 'bedroom', 'nightstand', 0.45, 0.4, 0.5, 4500, WOOD),
  P('BD-WARD-2', 'Wardrobe, 2-door', 'bedroom', 'wardrobe', 1.0, 0.6, 2.1, 22000, WOOD, { params: { doors: 2 }, tags: ['almirah'] }),
  P('BD-WARD-3', 'Wardrobe, 3-door', 'bedroom', 'wardrobe', 1.5, 0.6, 2.1, 32000, WOOD, { params: { doors: 3 }, tags: ['almirah'] }),
  P('BD-WARD-SL', 'Sliding wardrobe, 2.4 m', 'bedroom', 'wardrobe', 2.4, 0.65, 2.4, 68000, WOOD, { params: { doors: 2, sliding: true }, tags: ['almirah'] }),
  P('BD-DRESSER', 'Dresser with mirror', 'bedroom', 'dresser', 1.0, 0.45, 1.6, 14000, WOOD),

  // Kitchen (modular)
  P('KT-BASE-60', 'Base cabinet, 600', 'kitchen', 'base', 0.6, 0.6, 0.88, 9000, KITCHEN, { tags: ['modular'] }),
  P('KT-BASE-90', 'Base cabinet, 900', 'kitchen', 'base', 0.9, 0.6, 0.88, 12500, KITCHEN, { tags: ['modular'] }),
  P('KT-SINK-90', 'Sink unit, 900', 'kitchen', 'base', 0.9, 0.6, 0.88, 18500, KITCHEN, { params: { sink: true }, tags: ['modular'] }),
  P('KT-HOB-90', 'Hob unit, 900', 'kitchen', 'base', 0.9, 0.6, 0.88, 24000, KITCHEN, { params: { hob: true }, tags: ['modular', 'stove'] }),
  P('KT-CORNER', 'Corner unit, 900', 'kitchen', 'base', 0.9, 0.9, 0.88, 16000, KITCHEN, { tags: ['modular'] }),
  P('KT-WALL-60', 'Wall cabinet, 600', 'kitchen', 'wallCab', 0.6, 0.35, 0.7, 6500, KITCHEN, { elev: 1.45, tags: ['modular', 'loft'] }),
  P('KT-WALL-90', 'Wall cabinet, 900', 'kitchen', 'wallCab', 0.9, 0.35, 0.7, 8500, KITCHEN, { elev: 1.45, tags: ['modular', 'loft'] }),
  P('KT-TALL', 'Tall pantry unit', 'kitchen', 'tall', 0.6, 0.6, 2.1, 26000, KITCHEN, { tags: ['modular'] }),
  P('KT-FRIDGE-1', 'Fridge, single door', 'kitchen', 'fridge', 0.6, 0.65, 1.5, 18000, ['#CDD3D7', '#7A2E2E', '#3A3F45'], { params: { doors: 1 } }),
  P('KT-FRIDGE-2', 'Fridge, double door', 'kitchen', 'fridge', 0.7, 0.7, 1.75, 32000, ['#CDD3D7', '#3A3F45'], { params: { doors: 2 } }),
  P('KT-CHIMNEY', 'Chimney, 900', 'kitchen', 'chimney', 0.9, 0.5, 0.6, 14000, ['#B8BEC2', '#2E2F31'], { elev: 1.55, tags: ['hood'] }),
  P('KT-BREAKFAST', 'Breakfast counter + 2 stools', 'kitchen', 'breakfast', 1.5, 0.6, 1.05, 21000, KITCHEN, { wallSnap: false }),

  // Dining
  P('DN-4', 'Dining set, 4-seater', 'dining', 'dining', 1.6, 1.6, 0.75, 28000, WOOD, { wallSnap: false, params: { seats: 4 } }),
  P('DN-6', 'Dining set, 6-seater', 'dining', 'dining', 2.2, 1.6, 0.75, 42000, WOOD, { wallSnap: false, params: { seats: 6 } }),
  P('DN-ROUND', 'Round dining, 4-seater', 'dining', 'dining', 1.6, 1.6, 0.75, 30000, WOOD, { wallSnap: false, params: { seats: 4, round: true } }),
  P('DN-CROCKERY', 'Crockery unit', 'dining', 'crockery', 1.2, 0.45, 1.9, 24000, WOOD),

  // Bath & utility
  P('BT-WC', 'WC, floor-mounted', 'bath', 'wc', 0.4, 0.68, 0.78, 9500, WHITE, { tags: ['toilet'] }),
  P('BT-WC-WALL', 'WC, wall-hung', 'bath', 'wc', 0.38, 0.54, 0.4, 16000, WHITE, { params: { wall: true }, tags: ['toilet'] }),
  P('BT-BASIN', 'Pedestal wash basin', 'bath', 'basin', 0.55, 0.45, 0.85, 5500, WHITE, { tags: ['sink'] }),
  P('BT-VANITY', 'Vanity with basin', 'bath', 'vanity', 0.8, 0.48, 0.85, 19000, ['#8E6A48', '#E8E3D8', '#3A3F45'], { tags: ['sink'] }),
  P('BT-SHOWER', 'Shower enclosure', 'bath', 'shower', 0.9, 0.9, 2.0, 24000, ['#B8BEC2']),
  P('BT-TUB', 'Bathtub', 'bath', 'tub', 1.7, 0.75, 0.55, 45000, WHITE),
  P('BT-WASHER', 'Washing machine', 'bath', 'washer', 0.6, 0.6, 0.85, 28000, ['#F2F2F0', '#9AA1A6']),

  // Study
  P('OF-DESK', 'Study desk', 'office', 'desk', 1.2, 0.6, 0.75, 9500, WOOD),
  P('OF-DESK-L', 'L-shaped desk', 'office', 'ldesk', 1.6, 1.4, 0.75, 21000, WOOD),
  P('OF-CHAIR', 'Office chair', 'office', 'officeChair', 0.6, 0.6, 1.1, 8500, ['#2E2F31', '#5F7484'], { wallSnap: false }),
  P('OF-FILE', 'Filing cabinet', 'office', 'filing', 0.45, 0.55, 1.3, 9000, ['#9AA1A6', '#3A3F45']),

  // Pooja & decor
  P('DC-POOJA', 'Pooja mandir, floor', 'decor', 'pooja', 0.9, 0.5, 1.9, 26000, ['#C8963F', '#8E6A48', '#F0EDE6'], { tags: ['temple', 'mandir'] }),
  P('DC-POOJA-W', 'Pooja unit, wall-mounted', 'decor', 'pooja', 0.75, 0.35, 0.9, 12000, ['#C8963F', '#8E6A48', '#F0EDE6'], { elev: 1.0, params: { wall: true }, tags: ['temple', 'mandir'] }),
  P('DC-PLANT-S', 'Plant, small', 'decor', 'plant', 0.35, 0.35, 0.6, 1200, ['#A85A3A', '#D9D4CA', '#3A3F45'], { wallSnap: false, params: { size: 0.6 } }),
  P('DC-PLANT-L', 'Plant, large', 'decor', 'plant', 0.55, 0.55, 1.5, 3500, ['#A85A3A', '#D9D4CA', '#3A3F45'], { wallSnap: false, params: { size: 1 } }),
  P('DC-SHOE', 'Shoe rack', 'decor', 'shoeRack', 0.9, 0.35, 1.0, 6500, WOOD),
];

export const SKU = Object.fromEntries(CATALOG.map((i) => [i.sku, i]));

export const FLOORS = {
  vitrified: { label: 'Vitrified tile', color: '#E4DED2' },
  marble: { label: 'Marble', color: '#ECEAE6' },
  wood: { label: 'Wood plank', color: '#A9774C' },
  tile: { label: 'Ceramic tile', color: '#C9D7DC' },
  kota: { label: 'Kota stone', color: '#8F9A86' },
  granite: { label: 'Granite', color: '#5A5A5E' },
  carpet: { label: 'Carpet', color: '#7F8C9C' },
};

export const WALL_TYPES = [
  { v: 0.115, l: '4½″ brick (115 mm)' },
  { v: 0.15, l: '6″ block (150 mm)' },
  { v: 0.23, l: '9″ brick (230 mm)' },
];
