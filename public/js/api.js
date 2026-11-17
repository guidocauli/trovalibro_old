// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>


// Wrapper attorno a fetch() per le chiamate alle API REST di backend.
// Centralizza la gestione JSON, errori e invio di sesison cookie.


const api = { 
    async request(method, url, body, isFormData = false) { 
        const opts = { method, credentials: 'same-origin' };
        if (body !== undefined) {
            if (isFormData) { 
                opts.body = body;    // FormData: il browser imposta automaticamente il content-Type multipart  
            } else {
                opts.headers = { 'Content-Type': 'application/json' };
                opts.body = JSON.stringify(body); 
            }
        }

        const res = await fetch(url, opts);  
        let data = null; 
        try { data = await res.json(); } catch { /* risposta senza dati */ } 
         if (!res.ok) {
            const message = (data && data.error) || `Errore ${res.status}`; 
            throw new Error(message);
          }
        return data; 
     },
    get(url) { return this.request('GET', url); },
    post(url, body) { return this.request('POST', url, body); },
    put(url, body) { return this.request('PUT', url, body); },
    del(url) { return this.request('DELETE', url); },
    postForm(url, formData) { return this.request('POST', url, formData, true); },
    putForm(url, formData) { return this.request('PUT', url, formData, true); },
};



