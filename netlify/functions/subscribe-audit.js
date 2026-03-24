exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { nome, cognome, email, telefono, salone } = data;

  if (!nome || !cognome || !email || !telefono || !salone) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Campi mancanti' }) };
  }

  const API_KEY = process.env.BREVO_API_KEY_LANDING;
  const LIST_ID = parseInt(process.env.BREVO_LIST_ID_LANDING, 10);

  const payload = {
    email,
    attributes: {
      NOME:     nome,
      COGNOME:  cognome,
      SMS:      telefono,
      SALONE:   salone,
    },
    listIds: [LIST_ID],
    updateEnabled: true,
  };

  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();

    if (res.ok || res.status === 204) {
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // Contact might already exist — update it
    if (res.status === 400) {
      const json = JSON.parse(responseText);
      if (json.code === 'duplicate_parameter') {
        // Update existing contact
        const updateRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
          method: 'PUT',
          headers: {
            'api-key': API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            attributes: payload.attributes,
            listIds: [LIST_ID],
          }),
        });
        if (updateRes.ok || updateRes.status === 204) {
          return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
      }
    }

    console.error('Brevo error:', responseText);
    return { statusCode: 500, body: JSON.stringify({ error: 'Brevo error', detail: responseText }) };

  } catch (err) {
    console.error('Fetch error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
