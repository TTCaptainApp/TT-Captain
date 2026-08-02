// Sehr einfacher ICS-Parser: liest VEVENT-Blöcke und extrahiert
// SUMMARY, DTSTART und LOCATION. Deckt die gängigen Exportformate
// von myTischtennis/click-TT ab.

function entfalten(text) {
  // RFC5545: Fortsetzungszeilen beginnen mit einem Leerzeichen oder Tab
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

function parseDatumZeit(wert) {
  // wert z.B. "20260913T190000" oder "20260913"
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
        summary = zeile.split(':').slice(1).join(':').trim()
      } else if (zeile.startsWith('LOCATION')) {
        location = zeile.split(':').slice(1).join(':').trim()
      } else if (zeile.startsWith('DTSTART')) {
        dtstartWert = zeile.split(':').slice(1).join(':').trim()
      }
    }

    const { datum, uhrzeit } = parseDatumZeit(dtstartWert)
    return { summary, location, datum, uhrzeit }
  }).filter(e => e.datum) // Einträge ohne erkennbares Datum überspringen
}
