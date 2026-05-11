import { GameEvent, Match } from '../types';

export function buildMatchIndex(events: GameEvent[]): Match[] {
  const matchMap = new Map<string, GameEvent[]>();

  events.forEach(event => {
    const key = `${event.matchId}|${event.mapId}|${event.date}`;
    if (!matchMap.has(key)) {
      matchMap.set(key, []);
    }
    matchMap.get(key)!.push(event);
  });

  const matches: Match[] = [];

  matchMap.forEach((matchEvents, key) => {
    const [matchId, mapId, date] = key.split('|');

    const uniqueHumans = new Set<string>();
    const uniqueBots = new Set<string>();
    let killCount = 0;
    let deathCount = 0;
    let lootCount = 0;
    let stormDeathCount = 0;

    matchEvents.forEach(event => {
      if (event.isBot) {
        uniqueBots.add(event.userId);
      } else {
        uniqueHumans.add(event.userId);
      }

      if (event.event === 'Kill' || event.event === 'BotKill') killCount++;
      if (event.event === 'Killed' || event.event === 'BotKilled') deathCount++;
      if (event.event === 'Loot') lootCount++;
      if (event.event === 'KilledByStorm') stormDeathCount++;
    });

    const timestamps = matchEvents.map(e => e.ts);
    const startTs = Math.min(...timestamps);
    const endTs = Math.max(...timestamps);

    matches.push({
      matchId,
      mapId: mapId as any,
      date,
      humanCount: uniqueHumans.size,
      botCount: uniqueBots.size,
      killCount,
      deathCount,
      lootCount,
      stormDeathCount,
      duration: endTs - startTs,
      startTs,
      endTs,
    });
  });

  return matches.sort((a, b) => a.date.localeCompare(b.date));
}
