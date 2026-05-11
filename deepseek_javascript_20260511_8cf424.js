const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.text({ limit: '50mb', type: 'text/xml' }));
app.use(express.raw({ limit: '50mb', type: 'application/xml' }));
app.use(express.static(__dirname));

// File dati
const DATA_FILE = path.join(__dirname, 'data', 'prodotti.json');
const IMAGE_FILE = path.join(__dirname, 'data', 'images.json');

// Crea cartella data se non esiste
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Carica dati
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch(e) {
        console.error('Errore caricamento dati:', e.message);
    }
    return { products: [], lastUpdate: null };
}

// Salva dati
function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        console.log('Dati salvati:', data.products.length, 'prodotti');
    } catch(e) {
        console.error('Errore salvataggio:', e.message);
    }
}

// Carica mappa immagini
function loadImageMap() {
    try {
        if (fs.existsSync(IMAGE_FILE)) {
            return JSON.parse(fs.readFileSync(IMAGE_FILE, 'utf8'));
        }
    } catch(e) {}
    return {};
}

// Salva mappa immagini
function saveImageMap(map) {
    try {
        fs.writeFileSync(IMAGE_FILE, JSON.stringify(map, null, 2));
    } catch(e) {
        console.error('Errore salvataggio immagini:', e.message);
    }
}

// ============================================================
// ENDPOINT PRINCIPALE: Riceve XML da Danea
// ============================================================
app.post('/api/sync', (req, res) => {
    try {
        let xmlString = req.body;
        
        // Pulisci l'XML
        if (typeof xmlString === 'string') {
            xmlString = xmlString.replace(/^\uFEFF/, '');
        }
        
        console.log('📥 XML ricevuto da Danea');
        
        // Estrai prodotti
        const products = extractProducts(xmlString);
        console.log('📦 Prodotti trovati:', products.length);
        
        if (products.length === 0) {
            return res.json({ success: false, message: 'Nessun prodotto trovato' });
        }
        
        // Carica dati esistenti
        const data = loadData();
        const imageMap = loadImageMap();
        
        // Aggiorna o aggiungi
        let updated = 0;
        let added = 0;
        
        products.forEach(newProd => {
            const idx = data.products.findIndex(p => p.code === newProd.code);
            
            // Mantieni immagine se esiste
            if (idx >= 0 && data.products[idx].img) {
                newProd.img = data.products[idx].img;
            } else if (imageMap[newProd.code]) {
                newProd.img = imageMap[newProd.code];
            }
            
            if (idx >= 0) {
                data.products[idx] = newProd;
                updated++;
            } else {
                data.products.push(newProd);
                added++;
            }
        });
        
        data.lastUpdate = new Date().toISOString();
        saveData(data);
        
        console.log(`✅ Aggiornati: ${updated}, Nuovi: ${added}`);
        
        res.json({
            success: true,
            updated: updated,
            added: added,
            total: products.length,
            timestamp: data.lastUpdate
        });
        
    } catch(e) {
        console.error('❌ Errore sync:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ============================================================
// ENDPOINT: Restituisce il catalogo
// ============================================================
app.get('/api/catalogo', (req, res) => {
    const data = loadData();
    const imageMap = loadImageMap();
    
    res.json({
        products: data.products,
        imageMap: imageMap,
        lastUpdate: data.lastUpdate
    });
});

// ============================================================
// ENDPOINT: Salva mappa immagini
// ============================================================
app.post('/api/images', express.json(), (req, res) => {
    const imageMap = req.body;
    saveImageMap(imageMap);
    res.json({ success: true });
});

// ============================================================
// Funzione: Estrai prodotti da XML Danea
// ============================================================
function extractProducts(xmlString) {
    const products = [];
    const regex = /<Product>([\s\S]*?)<\/Product>/gi;
    let match;
    
    while ((match = regex.exec(xmlString)) !== null) {
        const block = match[1];
        
        const code = extractTag(block, 'Code');
        if (!code) continue;
        
        const name = extractTag(block, 'Description') || code;
        const category = extractTag(block, 'Category') || 'DA DANEA';
        const supplier = extractTag(block, 'SupplierName') || 'N/D';
        const notes = extractTag(block, 'Notes') || '';
        let price = extractTag(block, 'NetPrice1') || '0'; // LISTINO 1
        
        // Formatta prezzo
        const num = parseFloat(price.replace(',', '.'));
        price = isNaN(num) ? '0,00' : num.toFixed(4).replace('.', ',');
        
        products.push({
            code: code,
            name: name,
            category: category,
            manufacturer: supplier,
            price: price,
            note: notes,
            source: 'danea'
        });
    }
    
    return products;
}

function extractTag(text, tag) {
    const regex = new RegExp('<' + tag + '>([^<]*)</' + tag + '>', 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
}

// ============================================================
// Avvio server
// ============================================================
app.listen(PORT, () => {
    console.log('🚀 Server attivo sulla porta ' + PORT);
    console.log('📡 Sync endpoint: POST /api/sync');
    console.log('📋 Catalogo: GET /api/catalogo');
    console.log('🌐 Sito: http://localhost:' + PORT);
});