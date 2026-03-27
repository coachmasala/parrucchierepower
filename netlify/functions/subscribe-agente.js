// netlify/functions/subscribe-agente.js
//
// Raccoglie i lead della visita in salone → lista Brevo ID 7
// Campi Brevo da creare (Impostazioni → Attributi contatto):
//   NOME_SALONE       Testo
//   INDIRIZZO_SALONE  Testo
//   SMS               già presente di default
//
// Variabile d'ambiente Netlify richiesta:
//   BREVO_API_KEY

const BREVO_API = 'https://api.brevo.com/v3/contacts';
const LIST_ID   = 7;

exports.handler = async function (event) {

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON non valido' }) };
  }

  const { nome, cognome, email, telefono, salone, indirizzo } = data;

  const missing = ['nome','cognome','email','telefono','salone','indirizzo']
    .filter(k => !data[k] || !String(data[k]).trim());
  if (missing.length) {
    return { statusCode: 422, body: JSON.stringify({ error: 'Campi obbligatori mancanti', fields: missing }) };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { statusCode: 422, body: JSON.stringify({ error: 'Email non valida' }) };
  }

  const headers = {
    'Content-Type': 'application/json',
    'api-key': process.env.BREVO_API_KEY,
  };

  const payload = {
    email: email.trim().toLowerCase(),
    attributes: {
      FIRSTNAME:        nome.trim(),
      LASTNAME:         cognome.trim(),
      SMS:              telefono.trim(),
      NOME_SALONE:      salone.trim(),
      INDIRIZZO_SALONE: indirizzo.trim(),
    },
    listIds:       [LIST_ID],
    updateEnabled: true,
  };

  try {
    const res = await fetch(BREVO_API, {
      method: 'POST', headers, body: JSON.stringify(payload),
    });

    if (res.status === 201 || res.status === 204) return ok();

    if (res.status === 400) {
      const err = await res.json().catch(() => ({}));
      if (err.code === 'duplicate_parameter') {
        return await updateContact(payload.email, payload.attributes, headers);
      }
      console.error('Brevo 400:', JSON.stringify(err));
      return serverError(JSON.stringify(err));
    }

    const body = await res.text();
    console.error('Brevo error:', res.status, body);
    return serverError(body);

  } catch (err) {
    console.error('Exception:', err);
    return serverError(err.message);
  }
};

async function updateContact(email, attributes, headers) {
  const res = await fetch(
    `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
    { method: 'PUT', headers, body: JSON.stringify({ attributes, listIds: [LIST_ID] }) }
  );
  if (res.status === 204) return ok();
  const body = await res.text();
  console.error('Brevo PUT error:', res.status, body);
  return serverError(body);
}

function ok()          { return { statusCode: 200, body: JSON.stringify({ success: true }) }; }
function serverError(d){ return { statusCode: 500, body: JSON.stringify({ error: 'Errore server', detail: d }) }; }
