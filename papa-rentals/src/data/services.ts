import { TRANSPORT_OPTIONS } from './catalog'
import type { View } from '../nav'
import type { IconName } from '../components/icons'
import { INSURANCE_RATE, OPERATOR_FEE_PER_DAY, SILVER_POINTS, money } from '../utils'

export type Service = { icon: IconName; title: string; body: string; to?: View }

/*
 * Everything Papa does — not just the rental departments but the services
 * wrapped around them. Figures come from the same constants the checkout maths
 * uses, so the copy can't drift. Built as a function rather than a constant
 * because the money() strings depend on those constants being loaded.
 *
 * Shared by the collapsed band on the home page and the full Services page.
 */
export function getServices(): Service[] {
  const van = TRANSPORT_OPTIONS.find((t) => t.id === 'van')
  const truck = TRANSPORT_OPTIONS.find((t) => t.id === 'truck')

  return [
    {
      icon: 'bolt',
      title: 'Instant booking',
      body: 'Book instant-book gear straight away — no waiting on approval.',
      to: { name: 'browse' },
    },
    {
      icon: 'handshake',
      title: 'Offer your price',
      body: 'See the recommended rate, then name yours. Owners accept, counter or decline.',
      to: { name: 'browse' },
    },
    {
      icon: 'van',
      title: 'Delivery to set',
      body: `Insured van delivery for ${money(van?.fee ?? 0)} — ${van?.eta ?? ''}, tracked to your location.`,
    },
    {
      icon: 'truck',
      title: 'Grip truck + crew',
      body: `${money(truck?.fee ?? 0)} brings a truck and a two-person crew who load, deliver and help you rig.`,
    },
    {
      icon: 'shield',
      title: 'Damage protection',
      body: `Optional cover at ${Math.round(INSURANCE_RATE * 100)}% of the rental. File a claim in-app and get paid to your wallet.`,
      to: { name: 'support' },
    },
    {
      icon: 'wrench',
      title: 'Certified operators',
      body: `Add a trained tech or licensed pilot for ${money(OPERATOR_FEE_PER_DAY)}/day on gear that needs one.`,
    },
    {
      icon: 'backpack',
      title: 'Production kits',
      body: 'Pre-bundled packages — camera, glass, key light and sound — at a package price.',
    },
    {
      icon: 'clock',
      title: 'Hourly studio hire',
      body: 'Spaces bookable by the hour as well as the day, with minimum-hour rules shown upfront.',
      to: { name: 'browse', category: 'studios' },
    },
    {
      icon: 'building',
      title: 'List your space or gear',
      body: 'Become a vendor in two minutes and keep 90% of every booking.',
      to: { name: 'post' },
    },
    {
      icon: 'chart',
      title: 'Host dashboard',
      body: 'Accept requests, track bookings and take automatic payouts to your wallet.',
      to: { name: 'dashboard' },
    },
    {
      icon: 'trophy',
      title: 'PapaPoints & perks',
      body: `Earn a point per Rs 100. ${SILVER_POINTS}+ unlocks free delivery; Gold takes 5% off every order.`,
      to: { name: 'profile' },
    },
    {
      icon: 'headset',
      title: '24/7 support',
      body: 'Help Centre, live chat and an emergency line for when a shoot goes sideways.',
      to: { name: 'support' },
    },
  ]
}
