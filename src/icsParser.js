function entfalten(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

function entmaskieren(wert) {
  // ICS maskiert Kommas, Semikolons, Backslashes und Zeilenumbrüche
  return wert
    .replace(/\\n/gi, ', ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

function parseDatumZeit(wert) {
  const match = wert.match(/(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2}))?/)
  if (!match) return { datum: null, uhrzeit: null }
  const [, jahr, monat, tag, , stunde, minute] = match
  const datum = `${jahr}-${monat}-${tag}`
  const uhrzeit = stunde ? `${stunde}:${minute}` : null
  return { datum, uhrzeit }
}

export function parseICS(text) {
  const entfaltet = entfalten(text)
  const bloecke = entfaltet.split('BEGIN:VEVENT').slice(1)

  return bloecke.map(block => {
    const ende = block.split('END:VEVENT')[0]
    const zeilen = ende.split('\n').map(z => z.trim()).filter(Boolean)

    let summary = ''
    let location = ''
    let dtstartWert = ''

    for (const zeile of zeilen) {
      if (zeile.startsWith('SUMMARY')) {
        summary = entmaskieren(zeile.split(':').slice(1).join(':').trim())
      } else if (zeile.startsWith('LOCATION')) {
        location = entmaskieren(zeile.split(':').slice(1).join(':').trim())
      } else if (zeile.startsWith('DTSTART')) {
        dtstartWert = zeile.split(':').slice(1).join(':').trim()
      }
    }

    const { datum, uhrzeit } = parseDatumZeit(dtstartWert)
    return { summary, location, datum, uhrzeit }
  }).filter(e => e.datum)
}

// Zerlegt eine Paarung wie "Team A vs Team B" in Heim-/Auswärts-Team und
// gibt den Gegner + Heim/Auswärts zurück, sofern der eigene Teamname erkannt wird.
export function gegnerErmitteln(summary, eigenerName) {
  const teile = summary.split(/\s+vs\.?\s+/i)

  if (teile.length === 2 && eigenerName && eigenerName.trim()) {
    const eigen = eigenerName.trim().toLowerCase()
    const [erste, zweite] = teile
    if (erste.toLowerCase().includes(eigen)) {
      return { gegner: zweite.trim(), heimAuswaerts: 'heim' }
    }
    if (zweite.toLowerCase().includes(eigen)) {
      return { gegner: erste.trim(), heimAuswaerts: 'auswaerts' }
    }
  }

  // Fallback: konnte nicht zugeordnet werden, komplette Paarung als Gegner anzeigen
  return { gegner: summary, heimAuswaerts: 'heim' }
}
