exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Method not allowed' }) };
  }

  let nome, email, telefono;
  try {
    const body = JSON.parse(event.body);
    nome     = (body.nome     || '').trim();
    email    = (body.email    || '').trim();
    telefono = (body.telefono || '').trim().replace(/\s+/g, '');
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Dati non validi' }) };
  }

  if (!nome || !email) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Nome e email obbligatori' }) };
  }

  const BREVO_KEY = process.env.BREVO_API_KEY;
  const LIST_ID   = parseInt(process.env.BREVO_LIST_ID, 10) || 3;

  const headers = {
    'Content-Type': 'application/json',
    'api-key': BREVO_KEY
  };

  // Normalizza telefono: assicura prefisso + senza duplicati
  let formattedPhone = telefono;
  if (formattedPhone) {
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.startsWith('00')) {
        formattedPhone = '+' + formattedPhone.substring(2);
      } else {
        formattedPhone = '+39' + formattedPhone;
      }
    }
  }

  const attributes = { NOME: nome };
  if (formattedPhone) attributes.SMS = formattedPhone;

  try {
    const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        attributes,
        listIds: [LIST_ID],
        updateEnabled: true
      })
    });
    if (!contactRes.ok && contactRes.status !== 204) {
      const err = await contactRes.text();
      console.error('Brevo contact error:', err);
      return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Errore iscrizione' }) };
    }
  } catch(e) {
    console.error('Contact fetch error:', e);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Errore di rete' }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
};
