// netlify/functions/subscribe-agente.js
//
// Variabili d'ambiente Netlify (aggiungere nel dashboard):
//   BREVO_API_KEY_AGENTE  → API key Brevo
//   BREVO_LIST_ID_AGENTE  → 7
//
// Attributi Brevo da creare (Impostazioni → Attributi contatto):
//   NOME_SALONE       → Testo
//   INDIRIZZO_SALONE  → Testo
//   SMS               → già presente di default

const BREVO_API = 'https://api.brevo.com/v3/contacts';

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

  const missing = ['nome', 'cognome', 'email', 'telefono', 'salone', 'indirizzo']
    .filter(k => !data[k] || !String(data[k]).trim());
  if (missing.length) {
    return {
      statusCode: 422,
      body: JSON.stringify({ error: 'Campi obbligatori mancanti', fields: missing }),
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { statusCode: 422, body: JSON.stringify({ error: 'Email non valida' }) };
  }

  const apiKey = process.env.BREVO_API_KEY_AGENTE;
  const listId = parseInt(process.env.BREVO_LIST_ID_AGENTE, 10);

  if (!apiKey || !listId) {
    console.error('Variabili d\'ambiente mancanti: BREVO_API_KEY_AGENTE o BREVO_LIST_ID_AGENTE');
    return { statusCode: 500, body: JSON.stringify({ error: 'Configurazione server mancante' }) };
  }

  const headers = {
    'Content-Type': 'application/json',
    'api-key': apiKey,
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
    listIds:       [listId],
    updateEnabled: true,
  };

  try {
    const res = await fetch(BREVO_API, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (res.status === 201 || res.status === 204) return ok();

    if (res.status === 400) {
      const err = await res.json().catch(() => ({}));
      if (err.code === 'duplicate_parameter') {
        return await updateContact(payload.email, payload.attributes, listId, headers);
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

async function updateContact(email, attributes, listId, headers) {
  const res = await fetch(
    `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ attributes, listIds: [listId] }),
    }
  );
  if (res.status === 204) return ok();
  const body = await res.text();
  console.error('Brevo PUT error:', res.status, body);
  return serverError(body);
}

function ok() {
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}

function serverError(detail) {
  return { statusCode: 500, body: JSON.stringify({ error: 'Errore server', detail }) };
}
