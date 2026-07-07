import type { Category, Item, Kit, Owner, TransportOption } from '../types'

// booked ranges are generated relative to "today" so the demo always has realistic availability
function rel(startOffset: number, endOffset: number) {
  const d = (o: number) => {
    const x = new Date()
    x.setDate(x.getDate() + o)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
  }
  return { start: d(startOffset), end: d(endOffset) }
}

export const CURRENCY = 'Rs'

export const CATEGORIES: Category[] = [
  { id: 'cameras', name: 'Cameras', emoji: '🎥', gradient: 'linear-gradient(135deg,#ff9a5a,#ff6b2c)' },
  { id: 'lenses', name: 'Lenses', emoji: '🔭', gradient: 'linear-gradient(135deg,#7f7fd5,#5a5ade)' },
  { id: 'lighting', name: 'Lighting', emoji: '💡', gradient: 'linear-gradient(135deg,#f7b733,#fc4a1a)' },
  { id: 'audio', name: 'Audio', emoji: '🎙️', gradient: 'linear-gradient(135deg,#43cea2,#185a9d)' },
  { id: 'grip', name: 'Grip & Rigs', emoji: '🎬', gradient: 'linear-gradient(135deg,#606c88,#3f4c6b)' },
  { id: 'drones', name: 'Drones', emoji: '🚁', gradient: 'linear-gradient(135deg,#36d1dc,#5b86e5)' },
  { id: 'transport', name: 'Transport', emoji: '🚐', gradient: 'linear-gradient(135deg,#f857a6,#ff5858)' },
  { id: 'studios', name: 'Studios & Spaces', emoji: '🏢', gradient: 'linear-gradient(135deg,#c471f5,#fa71cd)' },
  { id: 'props', name: 'Props & Sets', emoji: '🪑', gradient: 'linear-gradient(135deg,#b79891,#94716b)' },
  { id: 'crew', name: 'Crew Gear', emoji: '🧰', gradient: 'linear-gradient(135deg,#11998e,#38ef7d)' },
]

export const OWNERS: Owner[] = [
  { id: 'o1', name: 'LensCraft Studios', avatar: '🎞️', rating: 4.9, ratingCount: 412, verified: true, superOwner: true, responseMins: 8, area: 'DHA Phase 5', distanceKm: 2.4, memberSince: '2021' },
  { id: 'o2', name: 'Kamran Cine Hub', avatar: '🎩', rating: 4.7, ratingCount: 233, verified: true, superOwner: false, responseMins: 15, area: 'Gulberg III', distanceKm: 5.1, memberSince: '2022' },
  { id: 'o3', name: 'Frame & Fable Co.', avatar: '🦊', rating: 4.8, ratingCount: 187, verified: true, superOwner: true, responseMins: 5, area: 'Clifton Block 4', distanceKm: 3.8, memberSince: '2020' },
  { id: 'o4', name: 'Sara Productions', avatar: '🌟', rating: 4.5, ratingCount: 96, verified: false, superOwner: false, responseMins: 32, area: 'Johar Town', distanceKm: 9.6, memberSince: '2023' },
  { id: 'o5', name: 'GripMasters PK', avatar: '💪', rating: 4.6, ratingCount: 154, verified: true, superOwner: false, responseMins: 21, area: 'Model Town', distanceKm: 7.2, memberSince: '2022' },
  { id: 'o6', name: 'Noor Haveli Estates', avatar: '🏛️', rating: 4.9, ratingCount: 68, verified: true, superOwner: true, responseMins: 12, area: 'Walled City', distanceKm: 11.3, memberSince: '2023' },
  { id: 'me', name: 'You', avatar: '🎬', rating: 5, ratingCount: 0, verified: true, superOwner: false, responseMins: 1, area: 'Your location', distanceKm: 0, memberSince: '2026' },
  { id: 'support', name: 'Papa Support', avatar: '🎧', rating: 5, ratingCount: 9999, verified: true, superOwner: false, responseMins: 1, area: 'HQ', distanceKm: 0, memberSince: '2024' },
]

const r = (author: string, rating: number, text: string, date: string): import('../types').Review => ({
  id: `${author}-${date}`, author, rating, text, date, role: 'renter',
})

export const ITEMS: Item[] = [
  {
    id: 'i1', name: 'ARRI Alexa Mini LF', category: 'cameras', emoji: '🎥',
    pricePerDay: 85000, deposit: 150000, rating: 4.9, ratingCount: 128, ownerId: 'o1',
    specs: ['Large-format 4.5K sensor', 'ARRIRAW & ProRes', '2× 1TB Codex drives', 'EF & LPL mounts included', 'V-mount plates + 4 batteries'],
    description: 'The industry-standard large format cine camera. Package includes media, batteries, cage and top handle. Perfect for commercials, music videos and feature work.',
    tags: ['cinema', '4K', 'pro'], timesRented: 342, instantBook: true, offersAccepted: true,
    bookedRanges: [rel(4, 6), rel(12, 14)],
    reviews: [
      r('Ayesha K.', 5, 'Immaculate condition, owner even helped with the LUT setup. Will rent again.', '2026-06-18'),
      r('Bilal R.', 5, 'Sensor was spotless, batteries all held charge for the full 12h day.', '2026-05-30'),
      { ...r('Danish M.', 4, 'Great camera, pickup took a little longer than promised.', '2026-05-02'), ownerReply: 'Apologies for the wait, Danish — we now prep pickups the night before. Hope to host you again!' },
    ],
  },
  {
    id: 'i2', name: 'Sony FX6 Full-Frame Kit', category: 'cameras', emoji: '📹',
    pricePerDay: 28000, deposit: 60000, rating: 4.8, ratingCount: 214, ownerId: 'o2',
    specs: ['4K 120fps full-frame', 'Dual base ISO 800/12800', '2× 160GB CFexpress', 'Top handle + smallrig cage', '24-105 f/4 G included'],
    description: 'Run-and-gun favourite for documentaries and corporate shoots. Comes ready to roll with media, cage and a versatile zoom.',
    tags: ['documentary', '4K', 'run-and-gun'], timesRented: 518, instantBook: true, offersAccepted: true,
    bookedRanges: [rel(7, 8)],
    flashDeal: { percentOff: 15, endsInHours: 9 },
    reviews: [
      r('Hira S.', 5, 'Flawless kit, autofocus saved my one-man-band shoot.', '2026-06-21'),
      r('Omar T.', 5, 'Everything charged and formatted. Super smooth handover.', '2026-06-01'),
    ],
  },
  {
    id: 'i3', name: 'Blackmagic Pocket 6K Pro', category: 'cameras', emoji: '🎞️',
    pricePerDay: 12000, deposit: 25000, rating: 4.6, ratingCount: 167, ownerId: 'o4',
    specs: ['6K Super 35 sensor', 'Built-in ND filters', 'BRAW recording', '2× NP-F970 + T5 SSD', 'EF mount'],
    description: 'Indie filmmaker workhorse. Gorgeous BRAW footage on a budget, with SSD and batteries included.',
    tags: ['indie', '6K', 'budget'], timesRented: 289, instantBook: false, offersAccepted: true,
    reviews: [r('Zain A.', 5, 'Perfect for my short film, footage graded beautifully.', '2026-06-10')],
  },
  {
    id: 'i4', name: 'Cooke S4/i Prime Set (5 lens)', category: 'lenses', emoji: '🔭',
    pricePerDay: 45000, deposit: 120000, rating: 4.9, ratingCount: 76, ownerId: 'o1',
    specs: ['18/25/35/50/75mm T2.0', 'PL mount', 'The famous “Cooke look”', 'Matched colour across set', 'Flight case included'],
    description: 'Legendary warm rendering and smooth focus falloff. The set that makes skin tones sing.',
    tags: ['cinema', 'primes', 'PL'], timesRented: 158, instantBook: false, offersAccepted: true,
    reviews: [r('Mahnoor F.', 5, 'That Cooke glow is real. Perfectly collimated set.', '2026-05-25')],
  },
  {
    id: 'i5', name: 'Sigma 18-35 + 50-100 Cine Zooms', category: 'lenses', emoji: '🔎',
    pricePerDay: 9500, deposit: 20000, rating: 4.7, ratingCount: 143, ownerId: 'o4',
    specs: ['T2.0 constant aperture', 'EF mount', 'Geared focus/iris/zoom', '82mm front filter thread'],
    description: 'The indie zoom combo that covers 90% of narrative work. Sharp wide open.',
    tags: ['indie', 'zooms', 'EF'], timesRented: 231, instantBook: true, offersAccepted: true,
    reviews: [r('Ali H.', 5, 'Clean glass, smooth gears with my follow focus.', '2026-06-15')],
  },
  {
    id: 'i6', name: 'Aputure 600d Pro + Light Dome II', category: 'lighting', emoji: '💡',
    pricePerDay: 8500, deposit: 18000, rating: 4.8, ratingCount: 198, ownerId: 'o3',
    specs: ['600W daylight LED', 'Bowens mount', 'Light Dome II softbox', 'Sidus Link app control', 'Rolling case + stand'],
    description: 'Punchy sun-through-window key light. App controllable, silent fan mode for sound takes.',
    tags: ['LED', 'key light', 'bowens'], timesRented: 402, instantBook: true, offersAccepted: true,
    bookedRanges: [rel(5, 5)],
    flashDeal: { percentOff: 20, endsInHours: 5 },
    reviews: [r('Sana J.', 5, 'Bright as advertised, softbox was pristine.', '2026-06-22')],
  },
  {
    id: 'i7', name: 'Astera Titan Tube Kit (8×)', category: 'lighting', emoji: '🌈',
    pricePerDay: 22000, deposit: 45000, rating: 4.9, ratingCount: 87, ownerId: 'o3',
    specs: ['8× Titan Tubes', 'Wireless CRMX control', 'Full RGB + effects engine', 'Charging case included', '20h battery runtime'],
    description: 'The music video secret weapon. Wireless colour tubes you can rig anywhere — no cables, all vibes.',
    tags: ['RGB', 'music video', 'wireless'], timesRented: 176, instantBook: true, offersAccepted: true,
    reviews: [r('Faris Q.', 5, 'Ran a whole club scene off these. Insane flexibility.', '2026-06-05')],
  },
  {
    id: 'i8', name: 'Sennheiser MKH 416 Boom Kit', category: 'audio', emoji: '🎙️',
    pricePerDay: 5500, deposit: 12000, rating: 4.8, ratingCount: 254, ownerId: 'o2',
    specs: ['MKH 416 shotgun mic', 'Rode Blimp + deadcat', '3m carbon boom pole', 'XLR cables + shockmount'],
    description: 'The Hollywood dialogue standard. Full boom package ready for set.',
    tags: ['dialogue', 'boom', 'shotgun'], timesRented: 467, instantBook: true, offersAccepted: true,
    reviews: [r('Nida W.', 5, 'Crisp dialogue every take. Pole was light enough for 10h days.', '2026-06-19')],
  },
  {
    id: 'i9', name: 'Sound Devices MixPre-6 II + 2× Lavs', category: 'audio', emoji: '🎚️',
    pricePerDay: 7500, deposit: 15000, rating: 4.7, ratingCount: 132, ownerId: 'o2',
    specs: ['32-bit float recording', '2× Sennheiser G4 wireless lavs', '64GB SD + fresh AAs', 'Timecode ready'],
    description: 'Never clip audio again. 32-bit float recorder with two wireless lav channels.',
    tags: ['recorder', 'lav', 'wireless'], timesRented: 298, instantBook: true, offersAccepted: true,
    reviews: [r('Taimur B.', 4, 'Great sound, one lav clip was slightly worn.', '2026-05-28')],
  },
  {
    id: 'i10', name: 'DJI Ronin 2 + Ready Rig', category: 'grip', emoji: '🎬',
    pricePerDay: 18000, deposit: 40000, rating: 4.8, ratingCount: 94, ownerId: 'o5',
    specs: ['13.6kg payload gimbal', 'Ready Rig GS + ProArm', '4× TB50 batteries', 'Wireless follow focus ready'],
    description: 'Big-camera stabilisation for real cine builds. Includes the Ready Rig so your back survives the day.',
    tags: ['gimbal', 'stabiliser', 'heavy'], timesRented: 187, instantBook: false, offersAccepted: true,
    reviews: [r('Usman G.', 5, 'Balanced my Alexa Mini + Cookes no problem.', '2026-06-12')],
  },
  {
    id: 'i11', name: 'Dana Dolly + Track Package', category: 'grip', emoji: '🛤️',
    pricePerDay: 6500, deposit: 15000, rating: 4.7, ratingCount: 118, ownerId: 'o5',
    specs: ['Dana Dolly kit', '2× 8ft speed rail sections', 'Low boys + stands', '100mm bowl adapter'],
    description: 'The fastest dolly setup in the business. Silky lateral moves in five minutes flat.',
    tags: ['dolly', 'movement', 'track'], timesRented: 243, instantBook: true, offersAccepted: true,
    reviews: [r('Rabia N.', 5, 'Set up on rough ground easily. Buttery moves.', '2026-06-08')],
  },
  {
    id: 'i12', name: 'DJI Inspire 3 + Licensed Pilot', category: 'drones', emoji: '🚁',
    pricePerDay: 55000, deposit: 100000, rating: 4.9, ratingCount: 64, ownerId: 'o3',
    specs: ['8K full-frame X9-8K Air', 'Licensed pilot included', 'RTK centimetre positioning', 'O3 Pro 15km transmission', 'Permits assistance'],
    description: 'Cinema drone with a certified pilot on every booking. We handle NOC paperwork for city shoots.',
    tags: ['aerial', '8K', 'pilot included'], timesRented: 97, instantBook: false, offersAccepted: true,
    reviews: [r('Shayan L.', 5, 'Pilot nailed every move on the shotlist. Footage was unreal.', '2026-06-14')],
  },
  {
    id: 'i13', name: 'DJI Mavic 3 Cine', category: 'drones', emoji: '🛸',
    pricePerDay: 15000, deposit: 35000, rating: 4.7, ratingCount: 141, ownerId: 'o4',
    specs: ['5.1K ProRes internal', '1TB SSD built-in', '3 batteries + fast charger', 'ND filter set'],
    description: 'Fly-more cinema package. ProRes straight out of the sky.',
    tags: ['aerial', 'ProRes', 'compact'], timesRented: 205, instantBook: true, offersAccepted: true,
    reviews: [r('Emaan D.', 5, 'Batteries genuinely gave 3 full flights each.', '2026-06-03')],
  },
  {
    id: 'i14', name: '15-Seater Crew Van + Driver', category: 'transport', emoji: '🚐',
    pricePerDay: 18000, deposit: 0, rating: 4.6, ratingCount: 178, ownerId: 'o5',
    specs: ['Toyota Hiace, AC', 'Professional driver, 12h call', 'Fuel included within city', 'Roof rack for stands'],
    description: 'Move your whole crew and gear in one go. Driver is used to 5am call times.',
    tags: ['crew', 'van', 'driver included'], timesRented: 312, instantBook: true, offersAccepted: true,
    reviews: [r('Hassan Y.', 5, 'Driver was early, helped load the grip truck too.', '2026-06-20')],
  },
  {
    id: 'i15', name: '5-Ton Grip Truck (Loaded)', category: 'transport', emoji: '🚚',
    pricePerDay: 45000, deposit: 50000, rating: 4.8, ratingCount: 89, ownerId: 'o5',
    specs: ['Full grip & electric package', '12K/6K/4K HMIs', 'Stands, flags, rags, dollies', 'Driver + swing included', 'Genny tow option'],
    description: 'A rolling grip department. Everything a gaffer dreams of, plus a swing to help you rig it.',
    tags: ['grip truck', 'HMI', 'crew included'], timesRented: 134, instantBook: false, offersAccepted: true,
    reviews: [r('Adeel P.', 5, 'The truck IS the production. Worth every rupee.', '2026-05-31')],
  },
  {
    id: 'i16', name: 'Picture Car: 1967 Mustang', category: 'transport', emoji: '🏎️',
    pricePerDay: 60000, deposit: 200000, rating: 4.9, ratingCount: 41, ownerId: 'o1',
    specs: ['Fully restored, runs & drives', 'Handler on set included', 'Trailer delivery available', 'Insurance mandatory'],
    description: 'Hero picture car for that period look. Comes with a handler; insurance add-on is required at checkout.',
    tags: ['picture car', 'period', 'hero'], timesRented: 52, instantBook: false, offersAccepted: false,
    insuranceRequired: true, bookedRanges: [rel(3, 4)],
    reviews: [r('Kiran V.', 5, 'Stole every frame it was in.', '2026-05-15')],
  },
  {
    id: 'i17', name: 'Daylight Studio A (2000 sqft)', category: 'studios', emoji: '🏢',
    pricePerDay: 40000, deposit: 30000, rating: 4.8, ratingCount: 112, ownerId: 'o3',
    specs: ['2000 sqft, 14ft ceiling', 'North-facing daylight wall', 'Cyc wall + blackout option', 'Makeup room, kitchen, parking', '3-phase power'],
    description: 'Sunlit studio with a white cyc. Includes basic furniture, apple boxes and cleaning.',
    tags: ['studio', 'cyc', 'daylight'], timesRented: 264, instantBook: true, offersAccepted: true,
    hourly: true, bookedRanges: [rel(6, 6)],
    space: { type: 'Daylight studio', sqft: 2000, capacity: 25, amenities: ['White cyc wall', 'Blackout option', 'Makeup room', 'Kitchen', 'Parking ×6', '3-phase power', 'Wifi'], rules: ['No smoke machines without notice', 'Load-in via service lift only', 'Overtime billed per hour'], minHours: 4 },
    flashDeal: { percentOff: 10, endsInHours: 22 },
    reviews: [r('Mehak Z.', 5, 'Light in there is unreal from 10am–2pm. Host was lovely.', '2026-06-17')],
  },
  {
    id: 'i18', name: 'Greenscreen Stage B + Grid', category: 'studios', emoji: '🟩',
    pricePerDay: 32000, deposit: 25000, rating: 4.6, ratingCount: 78, ownerId: 'o4',
    specs: ['3-wall chroma cove', 'Lighting grid + 12 fresnels', 'Sound-treated', 'Client lounge + wifi'],
    description: 'Pre-lit greenscreen stage. Walk in, white balance, shoot.',
    tags: ['studio', 'chroma', 'VFX'], timesRented: 143, instantBook: true, offersAccepted: true,
    hourly: true,
    space: { type: 'Greenscreen stage', sqft: 1400, capacity: 18, amenities: ['3-wall chroma cove', 'Lighting grid', '12 fresnels', 'Sound treatment', 'Client lounge', 'Wifi'], rules: ['No paint touching the cove', 'Grid rigging by house tech only'], minHours: 3 },
    reviews: [r('Wali R.', 4, 'Great keying results. AC struggled a bit at noon.', '2026-06-06')],
  },
  {
    id: 'i19', name: 'Period Furniture Set (1940s)', category: 'props', emoji: '🪑',
    pricePerDay: 14000, deposit: 30000, rating: 4.7, ratingCount: 56, ownerId: 'o1',
    specs: ['Sofa, armchairs, radio, lamps', '40+ set dressing pieces', 'Curated by production designer', 'Delivery + placement help'],
    description: 'Instant 1940s drawing room. A designer-curated set that ships with placement photos.',
    tags: ['period', 'set dressing', 'curated'], timesRented: 87, instantBook: false, offersAccepted: true,
    reviews: [r('Anaya M.', 5, 'Art director cried tears of joy. Everything was period-correct.', '2026-05-22')],
  },
  {
    id: 'i20', name: 'Director’s Village Kit', category: 'crew', emoji: '🧰',
    pricePerDay: 9000, deposit: 20000, rating: 4.8, ratingCount: 102, ownerId: 'o2',
    specs: ['2× SmallHD 17" monitors', 'Teradek Bolt 4K TX/RX', 'Director chairs ×4, tent', 'Comtek listen kits ×6'],
    description: 'A proper video village: wireless monitors, shade, chairs and comteks for the client row.',
    tags: ['monitor', 'wireless video', 'village'], timesRented: 195, instantBook: true, offersAccepted: true,
    reviews: [r('Jibran S.', 5, 'Zero dropouts on the Teradek all day.', '2026-06-11')],
  },
  {
    id: 'i21', name: 'Skyline Rooftop Terrace', category: 'studios', emoji: '🌇',
    pricePerDay: 55000, deposit: 40000, rating: 4.8, ratingCount: 93, ownerId: 'o3',
    specs: ['City skyline backdrop', 'Golden-hour west view', 'Freight access to roof', 'Power drops ×4', 'Standing sets allowed'],
    description: 'The rooftop every music video wants. Unobstructed skyline, sunset gold, and a building manager who loves film crews.',
    tags: ['rooftop', 'exterior', 'skyline', 'sunset'], timesRented: 121, instantBook: true, offersAccepted: true,
    hourly: true, bookedRanges: [rel(8, 9)],
    space: { type: 'Rooftop', sqft: 3200, capacity: 40, amenities: ['Skyline view', 'Freight lift', 'Power drops', 'Washrooms', 'Security', 'Parking ×10'], rules: ['No drones without NOC', 'Wrap by 2am', 'No open flames'], minHours: 4 },
    reviews: [
      r('Moiz T.', 5, 'Sunset slot is unreal. Manager helped us rig safely on the parapet.', '2026-06-16'),
      r('Zoya L.', 5, 'Skyline reads beautifully even at night. Power was solid.', '2026-05-27'),
    ],
  },
  {
    id: 'i22', name: 'Noor Haveli (Heritage Home)', category: 'studios', emoji: '🏛️',
    pricePerDay: 90000, deposit: 100000, rating: 4.9, ratingCount: 47, ownerId: 'o6',
    specs: ['300-year-old walled-city haveli', 'Carved jharoka balconies', 'Central courtyard + fountain', 'Period furniture included', 'Caretaker on site'],
    description: 'A living period set. Frescoed walls, carved wood, courtyard light that DPs dream about. Dramas and films shoot here year-round.',
    tags: ['heritage', 'period', 'haveli', 'courtyard'], timesRented: 64, instantBook: false, offersAccepted: true,
    hourly: false, bookedRanges: [rel(10, 13)],
    space: { type: 'Heritage home', sqft: 8000, capacity: 60, amenities: ['Courtyard', 'Period furniture', 'Green rooms ×3', 'Caretaker', 'Genny hookup', 'Crew catering space'], rules: ['No nails or tape on frescoes', 'Heritage officer present for art dept changes', 'No shoots during Muharram'] },
    reviews: [
      r('Fatima D.', 5, 'Our period drama looked like a million dollars. The light in that courtyard!', '2026-06-09'),
      { ...r('Haris B.', 5, 'Owner family was gracious, caretaker knew every camera-friendly corner.', '2026-05-18'), ownerReply: 'You are welcome back any time — the haveli loved being on screen. 🙏' },
    ],
  },
  {
    id: 'i23', name: 'Raw Warehouse Shell (12k sqft)', category: 'studios', emoji: '🏭',
    pricePerDay: 35000, deposit: 30000, rating: 4.6, ratingCount: 58, ownerId: 'o5',
    specs: ['12,000 sqft clear span', '28ft ceiling, steel trusses', 'Drive-in roller door', 'Rig anything, paint anything', '100A 3-phase'],
    description: 'A blank canvas for set builds, car rigs and big lighting setups. Drive the grip truck straight in.',
    tags: ['warehouse', 'set build', 'industrial'], timesRented: 88, instantBook: true, offersAccepted: true,
    hourly: true,
    space: { type: 'Warehouse', sqft: 12000, capacity: 100, amenities: ['Drive-in access', '28ft ceiling', '100A power', 'Truss rigging OK', 'Washrooms', 'Chowkidar'], rules: ['Restore floor paint on wrap', 'Hot works need permit', 'No overnight storage without booking'], minHours: 6 },
    reviews: [r('Salman R.', 5, 'Built a two-room set and still had space for video village and catering.', '2026-06-04')],
  },
  {
    id: 'i24', name: 'Designer Penthouse Apartment', category: 'studios', emoji: '🛋️',
    pricePerDay: 48000, deposit: 60000, rating: 4.7, ratingCount: 71, ownerId: 'o4',
    specs: ['Magazine-grade interiors', 'Floor-to-ceiling windows', 'Italian kitchen (practical)', 'Elevator access', 'Neighbour-approved for shoots'],
    description: 'The "rich family apartment" every commercial needs. Shoots straight out of the box — no art department required.',
    tags: ['apartment', 'interior', 'luxury', 'commercial'], timesRented: 102, instantBook: true, offersAccepted: true,
    hourly: true, flashDeal: { percentOff: 10, endsInHours: 14 },
    space: { type: 'Apartment', sqft: 3400, capacity: 20, amenities: ['Practical kitchen', 'Natural light', 'Elevator', 'AC throughout', 'Parking ×4', 'Wifi'], rules: ['Shoe covers for crew', 'Max 20 crew', 'Furniture moves logged by owner'], minHours: 4 },
    reviews: [r('Mahira W.', 5, 'Client walked in and approved the location on the spot.', '2026-06-13')],
  },
]

export const KITS: Kit[] = [
  {
    id: 'k1', name: 'Indie Feature Starter', emoji: '🎬', itemIds: ['i3', 'i5', 'i6', 'i8'], percentOff: 18,
    blurb: 'Camera, glass, key light and sound — everything a first feature needs.',
  },
  {
    id: 'k2', name: 'Music Video Heat Pack', emoji: '🔥', itemIds: ['i2', 'i7', 'i10'], percentOff: 15,
    blurb: 'FX6, Astera tubes and a Ronin 2. Instant vibes, zero excuses.',
  },
  {
    id: 'k3', name: 'Commercial Day Bundle', emoji: '💼', itemIds: ['i1', 'i4', 'i15', 'i20'], percentOff: 12,
    blurb: 'Alexa, Cookes, a loaded grip truck and video village. Client-ready.',
  },
]

export const TRANSPORT_OPTIONS: TransportOption[] = [
  { id: 'pickup', name: 'Self pickup', emoji: '🙋', fee: 0, eta: 'You collect', detail: 'Pick up from the owner’s location at your chosen time. Bring CNIC.' },
  { id: 'van', name: 'Papa Van delivery', emoji: '🚐', fee: 2500, eta: '60–90 min', detail: 'Insured van delivery to your set, live-tracked like your food order.' },
  { id: 'truck', name: 'Grip truck + crew', emoji: '🚚', fee: 9000, eta: 'Scheduled', detail: 'Truck with a 2-person crew who load, deliver and help you rig.' },
]

export interface PromoRule {
  percentOff: number
  maxOff: number
  label: string
  minSubtotal?: number
  firstOrderOnly?: boolean
  singleUse?: boolean
}

export const PROMO_CODES: Record<string, PromoRule> = {
  PAPA10: { percentOff: 10, maxOff: 10000, label: '10% off (up to Rs 10,000)', minSubtotal: 5000 },
  FIRSTSHOOT: { percentOff: 20, maxOff: 15000, label: '20% off your first shoot (up to Rs 15,000)', firstOrderOnly: true, singleUse: true },
  INDIE5: { percentOff: 5, maxOff: 25000, label: '5% off, no minimum' },
}

export const PAYMENT_METHODS = [
  { id: 'card', name: 'Debit / credit card', emoji: '💳' },
  { id: 'jazzcash', name: 'JazzCash', emoji: '📱' },
  { id: 'easypaisa', name: 'Easypaisa', emoji: '📲' },
  { id: 'cod', name: 'Cash on delivery', emoji: '💵' },
]

export const RENTER_POOL = [
  { name: 'Rabia N.', rating: 4.9 },
  { name: 'Shayan L.', rating: 4.7 },
  { name: 'Mehak Z.', rating: 5.0 },
  { name: 'Usman G.', rating: 4.6 },
  { name: 'Fatima D.', rating: 4.8 },
]

export const DRIVER_POOL = [
  { name: 'Rashid A.', phone: '+92 300 1234567', vehicle: 'Hiace LEB-1234' },
  { name: 'Imran K.', phone: '+92 321 7654321', vehicle: 'Shehzore LES-8890' },
  { name: 'Waqas M.', phone: '+92 333 4455667', vehicle: 'Bolan LEC-5521' },
]

// what people also rent alongside each department — powers cross-sell
export const ALSO_RENTED: Record<string, string[]> = {
  cameras: ['lenses', 'grip', 'audio'],
  lenses: ['cameras', 'grip'],
  lighting: ['grip', 'transport'],
  audio: ['cameras', 'crew'],
  grip: ['lighting', 'transport'],
  drones: ['cameras', 'crew'],
  transport: ['grip', 'lighting'],
  studios: ['lighting', 'props'],
  props: ['studios', 'transport'],
  crew: ['cameras', 'audio'],
}

export const SPACE_TYPES = [
  { type: 'Studio', emoji: '🏢' },
  { type: 'Greenscreen stage', emoji: '🟩' },
  { type: 'Rooftop', emoji: '🌇' },
  { type: 'Heritage home', emoji: '🏛️' },
  { type: 'Warehouse', emoji: '🏭' },
  { type: 'Apartment', emoji: '🛋️' },
  { type: 'Café / restaurant', emoji: '☕' },
  { type: 'Farmhouse / outdoor', emoji: '🌳' },
]

export const AMENITY_OPTIONS = [
  'AC', 'Wifi', 'Parking', 'Power backup', 'Genny hookup', 'Makeup room', 'Green room',
  'Kitchen', 'Washrooms', 'Cyc wall', 'Lighting grid', 'Blackout', 'Freight lift', 'Security',
]

export const RULE_OPTIONS = [
  'No smoking', 'Shoe covers required', 'No overnight shoots', 'Permits required',
  'Max crew size applies', 'Restore on wrap', 'House tech must rig',
]

/* user-posted listings: registry so pure helpers (getItem etc.) can resolve them */
let USER_ITEMS: Item[] = []
export function syncUserListings(items: Item[]) {
  USER_ITEMS = items
}
export function userListings(): Item[] {
  return USER_ITEMS
}

export function getOwner(id: string): Owner {
  return OWNERS.find((o) => o.id === id) ?? OWNERS[0]
}

export function getItem(id: string): Item {
  return ITEMS.find((i) => i.id === id) ?? USER_ITEMS.find((i) => i.id === id) ?? ITEMS[0]
}

export function getCategory(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]
}
