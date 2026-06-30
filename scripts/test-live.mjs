import 'dotenv/config';
import { fetchLiveListings } from '../server/johnpyeLive.js';

process.env.JOHNPYE_MAX_EVENTS_PER_LOCATION = process.env.JOHNPYE_MAX_EVENTS_PER_LOCATION || '1';
process.env.JOHNPYE_MAX_PAGES = process.env.JOHNPYE_MAX_PAGES || '1';

const { listings, meta } = await fetchLiveListings();
console.log('meta', meta);
console.log('sample lots', listings.slice(0, 5).map((l) => ({
  id: l.id,
  title: l.title?.slice(0, 50),
  location: l.location,
  currentBid: l.currentBid,
  endsAt: l.endsAt,
})));
console.log('with endsAt', listings.filter((l) => l.endsAt).length, '/', listings.length);
