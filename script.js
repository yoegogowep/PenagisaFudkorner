// Ganti nomor WhatsApp UMKM di sini (gunakan format 62)
const NOMOR_WA_UMKM = "6282135783347";
const THEME_KEY = "umkm_theme";
const PURCHASED_PRODUCTS_KEY = "umkm_purchased_products";
const USER_ORDERS_KEY = "umkm_user_orders";
const COMMENT_LIKE_KEY = "umkm_liked_comments";
const ORDER_STATUS_LABELS = {
    new: 'Menunggu konfirmasi',
    queued: 'Dalam antrian',
    preparing: 'Sedang dibuat',
    delivered: 'Sudah sampai',
    cancelled: 'Dibatalkan',
    confirmed: 'Dikonfirmasi',
    completed: 'Selesai'
};
const ORDER_STATUS_STEPS = ['new', 'queued', 'preparing', 'delivered'];
const DEFAULT_REVIEWS = [
    {
        name: "Ipul",
        food: "Gyoza Kuah",
        rating: 5,
        message: "Kuahnya gurih, gyozanya lembut, dan porsinya pas untuk makan siang."
    },
    {
        name: "Fathan",
        food: "Cilok Lava",
        rating: 5,
        message: "Saus lavanya pedas dan nagih. Tekstur ciloknya juga kenyal."
    },
    {
        name: "Galih",
        food: "Cappucino Cincau",
        rating: 4,
        message: "Minumannya segar dan cincaunya banyak. Cocok diminum siang hari."
    },
    {
        name: "Titto",
        food: "Cilok Clasik",
        rating: 5,
        message: "Rasanya sederhana tapi enak, apalagi dimakan selagi hangat."
    }
];

// ====== AKSES ADMIN TERSEMBUNYI ======
// Ketuk pojok kiri atas layar loading 5x untuk memunculkan gerbang password admin.
const ADMIN_PASSWORD = "676767";
const ADMIN_SECRET_CODE = "4Loop67";
const ADMIN_SESSION_KEY = "umkm_admin_access";
const ADMIN_TAP_TARGET = 5;
const ADMIN_TAP_WINDOW_MS = 1200;
let adminTapCount = 0;
let adminTapLastTime = 0;
let adminDatabaseComments = [];
let adminDatabaseFeedback = [];
let adminConfirmAction = null;
let adminOrderSearchQuery = '';
let adminOrderStatusFilter = 'all';
let adminOrderExpanded = false;

const supabaseClient = window.supabase && window.SUPABASE_CONFIG?.url && window.SUPABASE_CONFIG?.anonKey
    ? window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey)
    : null;

function getVisitorId() {
    let visitorId = localStorage.getItem('umkm_visitor_id');
    if (!visitorId) {
        visitorId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem('umkm_visitor_id', visitorId);
    }
    return visitorId;
}

function getDeviceType() {
    if (window.matchMedia('(max-width: 600px)').matches) return 'mobile';
    if (window.matchMedia('(max-width: 1024px)').matches) return 'tablet';
    return 'desktop';
}

async function recordAudienceClick() {
    if (!supabaseClient) return;

    await supabaseClient.from('link_clicks').insert({
        link_url: window.location.href,
        source: new URLSearchParams(window.location.search).get('utm_source') || 'direct',
        referrer: document.referrer || null,
        visitor_id: getVisitorId(),
        device_type: getDeviceType(),
        user_agent: navigator.userAgent
    });
}

async function saveCommentToDatabase(comment) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.from('comments').insert({
        ...comment,
        likes: Number(comment.likes || 0),
        status: 'approved'
    });
    if (error) console.error('Komentar gagal disimpan ke database:', error);
}

async function saveFeedbackToDatabase(feedback) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.from('feedback_messages').insert({
        name: feedback.name,
        contact: feedback.contact,
        message: feedback.message,
        status: 'new'
    });

    if (error) {
        console.error('Kritik & saran gagal disimpan ke database:', error);
        return false;
    }

    return true;
}

async function loadCommentsFromDatabase() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
        .from('comments')
        .select('id, name, food, rating, message, likes, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
    if (!error && data?.length) {
        const normalized = data.map((comment) => ({
            ...comment,
            id: comment.id || `${comment.name}-${comment.food}-${comment.created_at || Date.now()}`,
            likes: Number(comment.likes || 0)
        }));
        localStorage.setItem('umkm_reviews', JSON.stringify(normalized));
        renderReviews();
    }
}

async function saveOrderToDatabase(order, items) {
    if (!supabaseClient) return { id: null };
    const { data, error } = await supabaseClient.from('sales_orders').insert(order).select('id').single();
    if (error || !data) {
        console.error('Pesanan gagal disimpan ke database:', error);
        if (error) showAdminToast('Database', `Pesanan gagal disimpan: ${error.message}`);
        return false;
    }
    const { error: itemError } = await supabaseClient.from('sales_order_items').insert(
        items.map(item => ({ ...item, order_id: data.id }))
    );
    if (itemError) console.error('Detail pesanan gagal disimpan:', itemError);
    return itemError ? false : { id: data.id };
}

function getUserLocalOrders() {
    try {
        return JSON.parse(localStorage.getItem(USER_ORDERS_KEY)) || [];
    } catch (error) {
        return [];
    }
}

function saveUserLocalOrders(orders) {
    localStorage.setItem(USER_ORDERS_KEY, JSON.stringify(orders));
}

function formatOrderStatus(status) {
    return ORDER_STATUS_LABELS[status] || 'Menunggu konfirmasi';
}

function addUserOrderRecord(orderData) {
    const orders = getUserLocalOrders();
    const record = {
        id: orderData.id || `local-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        created_at: orderData.created_at || new Date().toISOString(),
        customer_name: orderData.customer_name || 'Pelanggan',
        order_type: orderData.order_type || 'Delivery',
        address: orderData.address || '-',
        note: orderData.note || '',
        total_amount: Number(orderData.total_amount || 0),
        payment_method: orderData.payment_method || 'COD',
        payment_status: orderData.payment_status || 'pending',
        payment_proof_url: orderData.payment_proof_url || '',
        status: orderData.status || 'new',
        items: Array.isArray(orderData.items) ? orderData.items : []
    };
    orders.unshift(record);
    saveUserLocalOrders(orders);
    return record;
}

function cancelUserOrder(orderId) {
    const orders = getUserLocalOrders();
    const target = orders.find(order => order.id === orderId);
    if (!target) return false;
    if (!['new', 'queued'].includes(target.status)) {
        showInlineAlert('Pesanan hanya bisa dibatalkan sebelum dibuat atau saat masih dalam antrian.');
        return false;
    }
    target.status = 'cancelled';
    saveUserLocalOrders(orders);
    renderMyOrdersInCart();
    if (supabaseClient && !String(orderId).startsWith('local-')) {
        supabaseClient.from('sales_orders').update({ status: 'cancelled' }).eq('id', orderId).then(({ error }) => {
            if (error) console.error('Gagal membatalkan pesanan di database:', error);
        });
    }
    showInlineAlert('Pesanan berhasil dibatalkan.');
    return true;
}

function deleteUserOrder(orderId) {
    const orders = getUserLocalOrders();
    const targetIndex = orders.findIndex((order) => order.id === orderId);
    if (targetIndex === -1) return false;

    const target = orders[targetIndex];
    const allowedStatuses = ['delivered', 'completed', 'cancelled'];
    if (!allowedStatuses.includes(target.status)) {
        showInlineAlert('Pesanan hanya bisa dihapus setelah sampai atau dibatalkan.');
        return false;
    }

    const removeFromLocalList = () => {
        orders.splice(targetIndex, 1);
        saveUserLocalOrders(orders);
        renderMyOrdersInCart();
        showInlineAlert('Pesanan berhasil dihapus.');
    };

    const isDatabaseOrder = supabaseClient
        && !String(orderId).startsWith('local-')
        && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(String(orderId));

    if (isDatabaseOrder) {
        supabaseClient.from('sales_orders').delete().eq('id', orderId).then(({ error }) => {
            if (error) {
                console.error('Gagal menghapus pesanan di database:', error);
                showInlineAlert('Pesanan gagal dihapus dari database.');
                return;
            }
            removeFromLocalList();
        });
        return true;
    }

    removeFromLocalList();
    return true;
}

async function confirmOrderDelivery(orderId, received) {
    const orders = getUserLocalOrders();
    const target = orders.find((order) => order.id === orderId);
    if (!target) return;

    target.delivery_confirmation = received ? 'received' : 'not_received';
    if (received) target.status = 'completed';
    saveUserLocalOrders(received ? orders.filter((order) => order.id !== orderId) : orders);

    if (supabaseClient && !String(orderId).startsWith('local-')) {
        const update = {
            delivery_confirmation: received ? 'received' : 'not_received',
            delivery_confirmation_at: new Date().toISOString()
        };
        if (received) update.status = 'completed';
        const { error } = await supabaseClient.from('sales_orders').update(update).eq('id', orderId);
        if (error) {
            console.error('Konfirmasi penerimaan gagal disimpan:', error);
            showInlineAlert('Konfirmasi belum tersimpan. Coba lagi.');
            return;
        }
    }

    renderMyOrdersInCart();
    showInlineAlert(received ? 'Pesanan selesai. Terima kasih.' : 'Laporan belum sampai sudah diteruskan ke admin.');
}

function openPaymentProofModal(url) {
    const modal = document.getElementById('paymentProofPreviewModal');
    const image = document.getElementById('paymentProofPreviewImage');
    const link = document.getElementById('paymentProofPreviewLink');
    if (!modal || !image || !link || !url) return;
    image.src = url;
    link.href = url;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
}

function closePaymentProofModal() {
    const modal = document.getElementById('paymentProofPreviewModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

function openOrderStatus() {
    const modal = document.getElementById('orderStatusModal');
    if (!modal) return;
    closeCartModal();
    renderMyOrdersInCart();
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('review-popup-open');
}

function closeOrderStatus() {
    const modal = document.getElementById('orderStatusModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('review-popup-open');
}

function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';

    const button = document.querySelector('.theme-toggle');
    if (button) {
        const icon = `<i class="fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}"></i>`;
        button.innerHTML = button.classList.contains('nav-hamburger-theme') || button.closest('.nav-tools-item')
            ? `${icon}<span>Ganti tema</span>`
            : icon;
        button.setAttribute('aria-label', isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap');
    }
}

function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
}

function getWebsiteLink() {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/kontak\.html$/, 'index.html');
    return url.toString();
}

function copyWebsiteLink() {
    const status = document.getElementById('copyLinkStatus');
    const link = getWebsiteLink();

    navigator.clipboard.writeText(link).then(() => {
        if (status) status.textContent = 'Link berhasil disalin.';
    }).catch(() => {
        if (status) status.textContent = 'Link: ' + link;
    });
}

function continueToMenu() {
    const gate = document.getElementById('gateScreen');
    if (gate) gate.classList.add('is-hidden');
    document.body.classList.remove('gate-open');
    document.body.classList.add('gate-ready');
}

function startMenuIntro(gate) {
    window.setTimeout(() => {
        gate.classList.add('is-hidden');
        document.body.classList.remove('gate-open');
        document.body.classList.add('gate-ready');
    }, 2800);
}

// DATA MENU (hanya 3 item)
const menuItems = [
    {
        id: 1,
        name: "Cappucino Cincau",
        category: "minuman",
        price: 5000,
        rating: 4.8,
        shortDesc: "Kopi cappucino dengan rasa cincau yang lezat.",
        desc: "Minuman kopi cappucino yang diberi sentuhan rasa cincau yang khas, cocok untuk menikmati hari-hari yang cerah.",
        ingredients: ["Bubuk Cappucino pilihan", "Cincau", "Gula", "Es batu"],
        highlight: "Rasa manis, segar dan kenyal dari cincau yang membuat perpaduannya istimewa.",
        images: [
            "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80"
        ]
    },
    {
        id: 2,
        name: "Gyoza Kuah",
        category: "makanan",
        price: 5000,
        rating: 4.9,
        shortDesc: "Gyoza dengan kuah sup yang lezat.",
        desc: "Gyoza yang digoreng dan disajikan dengan kuah sup yang lezat, cocok untuk santapan utama.",
        ingredients: ["Daging cincang", "Sayuran", "Bumbu kuah"],
        highlight: "Berserat lezat, cocok untuk makan siang atau malam dengan porsi yang mengenyangkan.",
        images: [
            "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=900&q=80"
        ]
    },

    {
        id: 4,
        name: "Cilok Clasik",
        category: "makanan",
        price: 5000,
        rating: 4.8,
        shortDesc: "Es kopi susu gula aren asli gurih renyah.",
        desc: "Minuman kopi susu dengan sentuhan gula aren yang manis, creamy, dan bikin mood makin nikmat untuk menemani hari.",
        ingredients: ["Kopi bubuk pilihan", "Susu cair", "Gula aren", "Es batu"],
        highlight: "Rasa creamy dengan aroma kopi yang lembut, cocok untuk dinikmati kapan saja.",
        images: [
            "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=900&q=80"
        ]
    },
    {
        id: 5,
        name: "Menu Spesial Baru",
        category: "makanan",
        price: 0,
        rating: 5,
        shortDesc: "Segera hadir untuk melengkapi pilihan favoritmu.",
        desc: "Menu spesial baru dari Penagisa Food Corner sedang dipersiapkan untuk kamu.",
        ingredients: [],
        highlight: "Nantikan kejutan menu baru kami.",
        comingSoon: true,
        images: [
            "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80"
        ]
    },
    {
        id: 6,
        name: "Minuman Spesial Baru",
        category: "minuman",
        price: 0,
        rating: 5,
        shortDesc: "Kesegaran baru yang segera hadir untukmu.",
        desc: "Minuman spesial baru dengan rasa segar sedang dipersiapkan oleh Penagisa Food Corner.",
        ingredients: [],
        highlight: "Nantikan minuman baru yang menyegarkan.",
        comingSoon: true,
        images: [
            "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80"
        ]
    },
    {
        id: 7,
        name: "Seblak Komplit",
        category: "makanan",
        price: 0,
        rating: 5,
        shortDesc: "Seblak gurih pedas yang segera hadir.",
        desc: "Seblak komplit dengan isian pilihan dan kuah pedas gurih sedang dipersiapkan untuk kamu.",
        ingredients: [],
        highlight: "Nantikan sensasi pedas gurih dengan isian yang lebih lengkap.",
        comingSoon: true,
        images: [
            "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=80"
        ]
    }
];

// Ambil Keranjang dari localStorage agar tidak hilang saat pindah halaman
let cart = JSON.parse(localStorage.getItem('umkm_cart')) || {};
let cartDimTimer;
let pendingOrder = null;
let qrisPaymentConfirmed = false;
let qrisPaymentProofFile = null;
let orderSubmissionInProgress = false;

function refreshCartActivity() {
    clearTimeout(cartDimTimer);
}

function handleCartSummaryClick(event) {
    const floatingBar = document.getElementById('floatingCart');
    if (!floatingBar) return;

    event.preventDefault();
    if (!document.getElementById('cartModal')) {
        window.location.href = 'menu.html';
        return;
    }
    closeOrderStatus();
    toggleCartModal();
}

// FUNGSI RENDER MENU (Khusus index.html)
function renderMenu(items) {
    const grid = document.getElementById("menuGrid");
    if (!grid) return;

    grid.innerHTML = "";
    if (items.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color: var(--text-muted); padding: 30px 0;">Menu tidak ditemukan...</p>`;
        return;
    }

    items.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = `menu-card${item.comingSoon ? ' coming-soon-card' : ''}`;
        card.style.setProperty('--delay', `${index * 120}ms`);
        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${item.images[0]}" alt="${item.name}">
            </div>
            <div class="card-body">
                <h3 class="card-title">${item.name}</h3>
                <p class="card-desc">${item.shortDesc}</p>
                ${item.comingSoon ? '' : `
                    <div class="card-rating" aria-label="Rating ${item.rating} dari 5 bintang">
                        <span class="card-rating-stars">${'★'.repeat(Math.round(item.rating))}${'☆'.repeat(5 - Math.round(item.rating))}</span>
                        <strong>${item.rating.toFixed(1)}</strong>
                    </div>
                `}
                <div class="card-footer">
                    ${item.comingSoon ? `
                        <span class="coming-soon-label"><i class="fa-solid fa-clock"></i> Segera Hadir</span>
                    ` : `
                        <span class="card-price">Rp ${item.price.toLocaleString('id-ID')}</span>
                        <div class="menu-actions">
                            <a href="review.html?menu=${encodeURIComponent(item.name)}" class="review-btn">Review</a>
                            <button class="add-btn" data-id="${item.id}">+ Tambah</button>
                        </div>
                    `}
                </div>
            </div>
        `;

        card.addEventListener('click', (event) => {
            if (item.comingSoon) return;
            if (event.target.closest('.review-btn')) {
                event.stopPropagation();
                return;
            }
            if (event.target.closest('.add-btn')) {
                event.stopPropagation();
                addToCart(item.id);
                return;
            }
            openProductModal(item.id);
        });

        grid.appendChild(card);
    });
}

// LOGIKA TAMBAH & EDIT KERANJANG
function addToCart(id) {
    const item = menuItems.find(menuItem => menuItem.id === id);
    if (!item) return;

    cart[id] = (cart[id] || 0) + 1;
    saveAndRefreshCart();
    refreshCartActivity();
    showCartAddNotification(item.name, cart[id]);
}

function showCartAddNotification(itemName, quantity) {
    const stackCount = document.querySelectorAll('.cart-add-notification').length;

    const notification = document.createElement('div');
    notification.className = 'cart-add-notification';
    notification.innerHTML = `
        <i class="fa-solid fa-circle-check"></i>
        <span>${itemName} masuk ke keranjang (${quantity}x)</span>
    `;
    notification.style.bottom = `${116 + (stackCount * 56)}px`;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), 380);
    }, 2200);
}

function changeQty(id, delta) {
    if (cart[id]) {
        cart[id] += delta;
        if (cart[id] <= 0) delete cart[id];
    }
    saveAndRefreshCart();
}

function clearCart() {
    if (Object.keys(cart).length === 0) return;
    cart = {};
    saveAndRefreshCart();
}

function saveAndRefreshCart() {
    localStorage.setItem('umkm_cart', JSON.stringify(cart));
    updateCartUI();
}

// MODAL DETAIL MENU
function openProductModal(itemId) {
    const item = menuItems.find(m => m.id === itemId);
    const modal = document.getElementById('productModal');
    if (!item || !modal) return;

    let currentIndex = 0;
    const gallery = item.images;
    const imageCache = gallery.map((src) => {
        const image = new Image();
        image.src = src;
        return image;
    });

    const renderSlides = () => {
        const img = modal.querySelector('.product-main-image');
        const dots = modal.querySelectorAll('.dot');
        const requestedIndex = currentIndex;
        const applyImage = () => {
            if (!img || requestedIndex !== currentIndex) return;
            img.src = gallery[requestedIndex];
        };

        if (img) {
            if (imageCache[requestedIndex].complete && imageCache[requestedIndex].naturalWidth > 0) {
                applyImage();
            } else {
                imageCache[requestedIndex].addEventListener('load', applyImage, { once: true });
            }
        }
        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === currentIndex);
        });
    };

    modal.querySelector('.product-name').textContent = item.name;
    modal.querySelector('.product-price').textContent = `Rp ${item.price.toLocaleString('id-ID')}`;
    modal.querySelector('.product-desc').textContent = item.desc;
    modal.querySelector('.product-highlight').textContent = item.highlight;

    const list = modal.querySelector('.ingredient-list');
    list.innerHTML = item.ingredients.map(i => `<li>${i}</li>`).join('');

    const prevBtn = modal.querySelector('.gallery-prev');
    const nextBtn = modal.querySelector('.gallery-next');
    prevBtn.onclick = () => {
        currentIndex = (currentIndex - 1 + gallery.length) % gallery.length;
        renderSlides();
    };
    nextBtn.onclick = () => {
        currentIndex = (currentIndex + 1) % gallery.length;
        renderSlides();
    };

    const dotsWrap = modal.querySelector('.gallery-dots');
    dotsWrap.innerHTML = gallery.map((_, idx) => `
        <button class="dot ${idx === 0 ? 'active' : ''}" data-index="${idx}" aria-label="Gambar ${idx + 1}"></button>
    `).join('');

    dotsWrap.querySelectorAll('.dot').forEach(dot => {
        dot.addEventListener('click', () => {
            currentIndex = Number(dot.dataset.index);
            renderSlides();
        });
    });

    const addBtn = modal.querySelector('.product-add-btn');
    addBtn.onclick = () => {
        addToCart(item.id);
        closeProductModal();
    };

    renderSlides();
    modal.classList.remove('is-closing');
    modal.classList.add('active');
    document.body.classList.add('review-popup-open');
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (!modal || !modal.classList.contains('active')) return;

    modal.classList.add('is-closing');
    document.body.classList.remove('review-popup-open');
    setTimeout(() => {
        modal.classList.remove('active', 'is-closing');
    }, 200);
}

async function sendFeedbackToDatabase(event) {
    event.preventDefault();

    const name = document.getElementById('feedbackName').value.trim();
    const contact = document.getElementById('feedbackContact').value.trim();
    const message = document.getElementById('feedbackMessage').value.trim();

    if (!name || !contact || !message) {
        showInlineAlert('Nama, kontak, dan pesan wajib diisi.');
        return;
    }

    const feedback = { name, contact, message };
    const saved = await saveFeedbackToDatabase(feedback);
    document.getElementById('feedbackForm').reset();

    if (saved && supabaseClient) {
        showInlineAlert('Kritik & saran berhasil dikirim dan tersimpan di database admin.');
    } else if (supabaseClient) {
        showInlineAlert('Kritik & saran gagal disimpan ke database. Silakan coba lagi.');
    } else {
        showInlineAlert('Koneksi database belum aktif, jadi kritik & saran belum tersimpan.');
    }
}

function getReviewAverage(reviews) {
    if (!reviews.length) return 1;

    const totalRating = reviews.reduce((sum, review) => sum + Number(review.rating), 0);
    return Math.min(5, Math.max(1, totalRating / reviews.length));
}

function getCurrentReviews() {
    const storedReviews = JSON.parse(localStorage.getItem('umkm_reviews')) || [];
    return storedReviews.length > 0 ? storedReviews : DEFAULT_REVIEWS;
}

function getLikedCommentIds() {
    try {
        return JSON.parse(localStorage.getItem(COMMENT_LIKE_KEY)) || [];
    } catch (error) {
        return [];
    }
}

function toggleLikeComment(commentId) {
    if (!commentId) return;

    const likedIds = getLikedCommentIds();
    const alreadyLiked = likedIds.includes(String(commentId));
    const nextLikedIds = alreadyLiked
        ? likedIds.filter((id) => id !== String(commentId))
        : [...likedIds, String(commentId)];
    localStorage.setItem(COMMENT_LIKE_KEY, JSON.stringify(nextLikedIds));

    const reviews = getCurrentReviews();
    const review = reviews.find((item) => String(item.id || `${item.name}-${item.food}-${item.message}`) === String(commentId));
    if (!review) return;

    const currentLikes = Number(review.likes || 0);
    review.likes = Math.max(0, currentLikes + (alreadyLiked ? -1 : 1));
    localStorage.setItem('umkm_reviews', JSON.stringify(reviews));

    if (supabaseClient && commentId) {
        supabaseClient.from('comments')
            .update({ likes: review.likes })
            .eq('id', commentId)
            .then(({ error }) => {
                if (error) console.error('Like komentar gagal disimpan:', error);
            });
    }

    renderReviews();
}

function syncRatings(reviews = getCurrentReviews()) {
    const averageRating = getReviewAverage(reviews);
    const ratingText = averageRating.toFixed(1);

    menuItems.forEach((item) => {
        if (item.baseRating === undefined) item.baseRating = item.rating;

        const productReviews = reviews.filter((review) => review.food === item.name);
        item.rating = productReviews.length > 0
            ? getReviewAverage(productReviews)
            : item.baseRating;
    });

    const infoRating = document.getElementById('infoAverageRating');
    if (infoRating) infoRating.textContent = `${ratingText} / 5`;

    return averageRating;
}

function renderReviewSummary(reviews) {
    const averageRating = getReviewAverage(reviews);
    const averageRatingText = averageRating.toFixed(1);
    const averageRatingElement = document.getElementById('reviewAverageRating');
    const averageStarsElement = document.getElementById('reviewAverageStars');

    if (averageRatingElement) averageRatingElement.textContent = averageRatingText;
    if (averageStarsElement) {
        const filledStars = Math.round(averageRating);
        averageStarsElement.textContent = '★'.repeat(filledStars) + '☆'.repeat(5 - filledStars);
        averageStarsElement.setAttribute('aria-label', `Rating rata-rata ${averageRatingText} dari 5 bintang`);
    }
}

function renderReviews(highlightLatest = false) {
    const reviewList = document.getElementById('reviewList');
    if (!reviewList) return;

    const reviews = getCurrentReviews();
    syncRatings(reviews);
    renderReviewSummary(reviews);
    reviewList.innerHTML = '';

    if (reviews.length === 0) {
        reviewList.innerHTML = '<p class="review-empty">Belum ada review. Jadilah yang pertama!</p>';
        return;
    }

    reviews.forEach((review, index) => {
        const reviewId = review.id || `${review.name}-${review.food}-${index}`;
        const likedCommentIds = getLikedCommentIds();
        const isLiked = likedCommentIds.includes(String(reviewId));
        const normalizedReview = {
            ...review,
            id: reviewId,
            likes: Number(review.likes || 0)
        };
        const item = document.createElement('article');
        item.className = `review-item${highlightLatest && index === 0 ? ' is-new' : ''}`;
        item.innerHTML = `
            <div class="review-item-header">
                <div>
                    <div class="review-item-name"></div>
                    <div class="review-item-food"></div>
                </div>
                <div class="review-item-meta">
                    <div class="review-item-stars" aria-label="${normalizedReview.rating} dari 5 bintang">${'★'.repeat(normalizedReview.rating)}${'☆'.repeat(5 - normalizedReview.rating)}</div>
                    <button type="button" class="review-like-btn ${isLiked ? 'is-liked' : ''}" data-comment-id="${reviewId}" aria-label="Sukai komentar dari ${normalizedReview.name}">
                        <i class="fa-solid fa-heart"></i>
                        <span>${normalizedReview.likes}</span>
                    </button>
                </div>
            </div>
            <p class="review-item-message"></p>
        `;
        item.querySelector('.review-item-name').textContent = normalizedReview.name;
        item.querySelector('.review-item-food').textContent = normalizedReview.food;
        item.querySelector('.review-item-message').textContent = normalizedReview.message;
        const likeButton = item.querySelector('.review-like-btn');
        likeButton?.addEventListener('click', () => toggleLikeComment(reviewId));
        reviewList.appendChild(item);
    });
}

function setupReviewForm() {
    const form = document.getElementById('reviewForm');
    if (!form) return;

    const stars = form.querySelectorAll('.star-btn');
    const ratingInput = document.getElementById('reviewRating');
    const foodInput = document.getElementById('reviewFood');
    const eligibilityMessage = document.getElementById('reviewEligibilityMessage');
    const purchasedProducts = JSON.parse(localStorage.getItem(PURCHASED_PRODUCTS_KEY)) || [];
    const selectedMenu = new URLSearchParams(window.location.search).get('menu');

    const menuOptions = Array.from(foodInput.options).filter((option) => option.value && purchasedProducts.includes(option.value));
    foodInput.innerHTML = '<option value="">Pilih menu yang dibeli</option>';
    menuOptions.forEach((option) => foodInput.appendChild(option));

    if (!purchasedProducts.length) {
        if (eligibilityMessage) eligibilityMessage.textContent = 'Review hanya dapat diberikan setelah kamu menyelesaikan pembelian.';
        form.querySelectorAll('input:not(#reviewRating), select, textarea, .star-btn, button[type="submit"]').forEach((control) => {
            control.disabled = true;
        });
        return;
    }

    if (eligibilityMessage) eligibilityMessage.textContent = 'Pilih produk yang sudah kamu beli, lalu bagikan pengalamanmu.';

    if (selectedMenu && purchasedProducts.includes(selectedMenu)) {
        foodInput.value = selectedMenu;
    }

    stars.forEach((star) => {
        star.addEventListener('click', () => {
            const rating = Number(star.dataset.rating);
            ratingInput.value = rating;
            stars.forEach((button) => {
                button.classList.toggle('is-selected', Number(button.dataset.rating) <= rating);
                button.setAttribute('aria-checked', Number(button.dataset.rating) === rating ? 'true' : 'false');
            });
        });
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!purchasedProducts.includes(foodInput.value)) {
            showInlineAlert('Kamu hanya dapat mereview produk yang sudah dibeli.');
            return;
        }
        const rating = Number(ratingInput.value);
        if (!rating) {
            showInlineAlert('Silakan pilih rating bintang terlebih dahulu.');
            return;
        }

        const comment = {
            id: crypto.randomUUID ? crypto.randomUUID() : `review-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: document.getElementById('reviewName').value.trim(),
            food: document.getElementById('reviewFood').value,
            rating,
            message: document.getElementById('reviewMessage').value.trim(),
            likes: 0
        };
        const storedReviews = JSON.parse(localStorage.getItem('umkm_reviews')) || [];
        const reviews = storedReviews.length > 0 ? storedReviews : [...DEFAULT_REVIEWS];
        reviews.unshift(comment);
        localStorage.setItem('umkm_reviews', JSON.stringify(reviews));
        await saveCommentToDatabase(comment);
        form.reset();
        ratingInput.value = '0';
        stars.forEach((button) => button.classList.remove('is-selected'));
        syncRatings(reviews);
        renderMenu(menuItems);
        renderReviews(true);
        showReviewThankYou();
    });
}

function showReviewThankYou() {
    const popup = document.getElementById('reviewThankYou');
    if (!popup) return;

    popup.classList.add('is-visible');
    popup.setAttribute('aria-hidden', 'false');
    document.body.classList.add('review-popup-open');
}

function closeReviewThankYou() {
    const popup = document.getElementById('reviewThankYou');
    if (!popup) return;

    popup.classList.remove('is-visible');
    popup.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('review-popup-open');
}

// PERBAHARUI TAMPILAN KERANJANG
// PERBARUAN FUNGSI KERANJANG & ARAHAN PEMESANAN

// FUNGSI MENGARAHKAN PENGGUNA KE MENU
function goToMenu() {
    closeCartModal();
    // Cek apakah pengguna berada di halaman menu
    const isMenuPage = window.location.pathname.endsWith("menu.html");

    if (!isMenuPage) {
        window.location.href = "menu.html";
    } else {
        const menuSection = document.getElementById("menuGrid");
        if (menuSection) {
            menuSection.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

// UPDATE TAMPILAN KERANJANG
function renderMyOrdersInCart() {
    const historyList = document.getElementById('userOrderHistoryList');
    if (!historyList) return;

    const orders = getUserLocalOrders();
    if (!orders.length) {
        historyList.innerHTML = '<p class="cart-empty-order">Belum ada pesanan yang dibuat.</p>';
        return;
    }

    historyList.innerHTML = orders.map((order) => {
        const canCancel = ['new', 'queued'].includes(order.status);
        const statusClass = order.status === 'cancelled' ? 'status-cancelled' : order.status === 'delivered' ? 'status-delivered' : 'status-active';
        const progressStatus = order.status === 'confirmed' ? 'new' : order.status === 'completed' ? 'delivered' : order.status;
        const currentStep = ORDER_STATUS_STEPS.indexOf(progressStatus);
        const progress = order.status === 'cancelled' ? 0 : Math.max(0, currentStep);
        return `
            <div class="user-order-item">
                <div class="user-order-top-row">
                    <div><strong class="order-code">Kode #${String(order.id).slice(0, 8).toUpperCase()}</strong><span class="user-order-meta">${new Date(order.created_at).toLocaleString('id-ID')}</span></div>
                    <span class="status-pill ${statusClass}"><i class="fa-solid fa-circle-notch"></i> ${formatOrderStatus(order.status)}</span>
                </div>
                <div class="user-order-type"><i class="fa-solid ${order.order_type === 'Takeaway' ? 'fa-shop' : 'fa-truck'}"></i> ${order.order_type === 'Takeaway' ? 'Ambil sendiri' : 'Diantar ke alamat'}</div>
                ${order.status !== 'cancelled' ? `<div class="order-progress" style="--progress-step:${progress}">${ORDER_STATUS_STEPS.map((step, index) => `<span class="order-progress-step ${index <= currentStep ? 'is-done' : ''}">${formatOrderStatus(step)}</span>`).join('')}</div>` : ''}
                <div class="user-order-meta">Total: Rp ${Number(order.total_amount || 0).toLocaleString('id-ID')}</div>
                <div class="user-order-items">${(order.items || []).map((item) => `${item.product_name} x${item.quantity}`).join(', ') || '-'}</div>
                ${order.status === 'delivered' ? `
                    <div class="delivery-confirmation">
                        <strong>Apakah makanan sudah sampai?</strong>
                        <div class="delivery-confirmation-actions">
                            <button type="button" class="delivery-confirm-btn" data-order-id="${order.id}" data-received="true">Iya</button>
                            <button type="button" class="delivery-confirm-btn delivery-confirm-btn-secondary" data-order-id="${order.id}" data-received="false">Tidak</button>
                        </div>
                    </div>
                ` : ''}
                <div class="user-order-actions">
                    ${order.payment_proof_url ? `<button type="button" class="proof-preview-btn" data-proof-url="${order.payment_proof_url}">Lihat bukti</button>` : ''}
                    ${canCancel ? `<button type="button" class="cancel-order-btn" data-order-id="${order.id}">Batalkan</button>` : ''}
                    ${['delivered', 'completed', 'cancelled'].includes(order.status) ? `<button type="button" class="cancel-order-btn delete-order-btn" data-order-id="${order.id}">Hapus</button>` : ''}
                </div>
            </div>
        `;
    }).join('');

    historyList.querySelectorAll('.proof-preview-btn').forEach((button) => {
        button.addEventListener('click', () => openPaymentProofModal(button.dataset.proofUrl));
    });
    historyList.querySelectorAll('.cancel-order-btn').forEach((button) => {
        const orderId = button.dataset.orderId;
        const isDeleteButton = button.classList.contains('delete-order-btn');
        button.addEventListener('click', () => isDeleteButton ? deleteUserOrder(orderId) : cancelUserOrder(orderId));
    });
    historyList.querySelectorAll('.delivery-confirm-btn').forEach((button) => {
        button.addEventListener('click', () => confirmOrderDelivery(button.dataset.orderId, button.dataset.received === 'true'));
    });
}

async function refreshUserOrdersFromDatabase() {
    if (!supabaseClient) return;
    const localOrders = getUserLocalOrders();
    const orderIds = localOrders.filter((order) => !String(order.id).startsWith('local-')).map((order) => order.id);
    if (!orderIds.length) return;

    const { data, error } = await supabaseClient.from('sales_orders')
        .select('id, status, payment_status, payment_proof_url')
        .in('id', orderIds);
    if (error || !data) return;

    let changed = false;
    data.forEach((serverOrder) => {
        const localOrder = localOrders.find((order) => order.id === serverOrder.id);
        if (!localOrder) return;
        const proofUrl = serverOrder.payment_proof_url || '';
        if (localOrder.status !== serverOrder.status || localOrder.payment_status !== serverOrder.payment_status || localOrder.payment_proof_url !== proofUrl) {
            Object.assign(localOrder, { status: serverOrder.status, payment_status: serverOrder.payment_status, payment_proof_url: proofUrl });
            changed = true;
        }
    });
    if (changed) {
        saveUserLocalOrders(localOrders);
        renderMyOrdersInCart();
    }
}

function updateCartUI() {
    let totalQty = 0;
    let totalPrice = 0;

    const cartList = document.getElementById("cartItemsList");
    const formContainer = document.getElementById("cartFormContainer");

    if (cartList) cartList.innerHTML = "";

    const keys = Object.keys(cart);

    if (keys.length === 0) {
        // TAMPILAN JIKA KERANJANG MASIH 0 PESANAN
        if (cartList) {
            cartList.innerHTML = `
                <div style="text-align:center; padding: 25px 10px;">
                    <i class="fa-solid fa-basket-shopping" style="font-size: 50px; color: var(--text-muted); margin-bottom: 12px; opacity: 0.4;"></i>
                    <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">Keranjang Belanja Kosong</h4>
                    <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">Kamu belum memilih menu apa pun. Yuk, jelajahi menu lezat kami!</p>
                    <button onclick="goToMenu()" class="add-btn" style="width: 100%; padding: 12px; font-size: 14px; border-radius: 25px;">
                        <i class="fa-solid fa-utensils" style="margin-right: 6px;"></i> Lihat Menu & Pesan Sekarang
                    </button>
                </div>
            `;
        }
        // Sembunyikan form checkout & tombol WA jika keranjang kosong
        if (formContainer) formContainer.style.display = "none";
    } else {
        // TAMPILKAN FORM JIKA ADA ISI KERANJANG
        if (formContainer) formContainer.style.display = "block";

        keys.forEach(id => {
            const item = menuItems.find(m => m.id == id);
            if (!item) return;
            const qty = cart[id];
            const subtotal = item.price * qty;

            totalQty += qty;
            totalPrice += subtotal;

            if (cartList) {
                const row = document.createElement("div");
                row.className = "cart-item";
                row.innerHTML = `
                    <div>
                        <h4 style="font-size:14px;">${item.name}</h4>
                        <span style="font-size:12px; color:var(--text-muted);">Rp ${subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="qty-btn" onclick="changeQty(${id}, -1)">-</button>
                        <span style="font-weight:700; font-size:13px;">${qty}</span>
                        <button class="qty-btn" onclick="changeQty(${id}, 1)">+</button>
                    </div>
                `;
                cartList.appendChild(row);
            }
        });
    }

    // Update Elemen Badge & Floating Bar
    const navBadge = document.getElementById("nav-cart-count");
    if (navBadge) {
        navBadge.innerText = totalQty;
        navBadge.classList.toggle('is-hidden', totalQty === 0);
    }

    const qtyPill = document.getElementById("cartQtyPill");
    if (qtyPill) qtyPill.innerText = `${totalQty} Item`;

    const priceText = document.getElementById("cartTotalPrice");
    if (priceText) priceText.innerText = `Rp ${totalPrice.toLocaleString('id-ID')}`;

    const cartButton = document.getElementById("floatingCart");
    if (cartButton) {
        cartButton.classList.toggle('has-items', totalQty > 0);
        cartButton.setAttribute('aria-label', totalQty > 0 ? `Lihat pesanan, ${totalQty} item` : 'Keranjang kosong');
    }

    renderMyOrdersInCart();
}

function toggleCartModal() {
    const modal = document.getElementById("cartModal");
    if (!modal) return;

    const isActive = modal.classList.toggle("active");
    document.body.classList.toggle('review-popup-open', isActive);
}

function closeCartModal() {
    const modal = document.getElementById("cartModal");
    if (modal) modal.classList.remove("active");
    if (!document.getElementById('productModal')?.classList.contains('active')) {
        document.body.classList.remove('review-popup-open');
    }
}

function updateOrderTypeFields() {
    const orderType = document.getElementById("orderType");
    const addressGroup = document.getElementById("addressGroup");
    const addressLabel = document.getElementById("addressLabel");
    const custAddress = document.getElementById("custAddress");
    const paymentMethod = document.getElementById('paymentMethod');

    if (!orderType || !addressGroup) return;

    const isDelivery = orderType.value === "Delivery";
    addressGroup.style.display = isDelivery ? "block" : "none";

    if (addressLabel) {
        addressLabel.textContent = "ALAMAT LENGKAP";
    }

    if (custAddress) {
        custAddress.placeholder = isDelivery ? "Isi alamat rumah Anda" : "";
    }

    if (paymentMethod) {
        paymentMethod.innerHTML = isDelivery
            ? '<option value="">Pilih metode pembayaran</option><option value="QRIS">QRIS</option><option value="COD">COD / Bayar di tempat</option>'
            : '<option value="Bayar di kasir">Bayar di kasir</option>';
        paymentMethod.value = isDelivery ? paymentMethod.value || '' : 'Bayar di kasir';
    }
}

// Tampilkan popup inline animasi untuk pesan singkat
function showInlineAlert(message, duration = 3000) {
    // Jika sudah ada alert aktif, reset teks dan timer
    let existing = document.querySelector('.inline-alert');
    if (existing) {
        existing.classList.remove('hide');
        existing.querySelector('span').textContent = message;
        if (existing._hideTimer) clearTimeout(existing._hideTimer);
        existing._hideTimer = setTimeout(() => {
            existing.classList.add('hide');
                existing._removeTimer = setTimeout(() => existing.remove(), 220);
        }, duration);
        return;
    }

    const el = document.createElement('div');
    el.className = 'inline-alert';
        el.innerHTML = `<strong>Pemberitahuan Pesanan</strong><span>${message}</span>`;
        el.setAttribute('role', 'alertdialog');
        el.setAttribute('aria-label', 'Pemberitahuan pesanan');
        el.addEventListener('click', () => {
            el.classList.add('hide');
            setTimeout(() => el.remove(), 220);
        });
    document.body.appendChild(el);

    el._hideTimer = setTimeout(() => {
        el.classList.add('hide');
        el._removeTimer = setTimeout(() => el.remove(), 300);
    }, duration);
}

function setOrderActionButton(label, showWhatsappIcon) {
    const button = document.getElementById('orderActionButton');
    if (!button) return;
    button.innerHTML = `${showWhatsappIcon ? '<i class="fa-brands fa-whatsapp"></i> ' : ''}${label}`;
}

function startOrderConfirmation() {
    if (orderSubmissionInProgress) return;
    if (pendingOrder) {
        completeOrder();
        return;
    }

    const name = document.getElementById("custName").value.trim();
    const type = document.getElementById("orderType").value;
    const addressInput = document.getElementById("custAddress");
    const address = addressInput ? addressInput.value.trim() : "";
    const noteInput = document.getElementById("orderNote");
    const note = noteInput ? noteInput.value.trim() : "";
    const paymentMethod = document.getElementById('paymentMethod')?.value;

    if (!name) {
        showInlineAlert("Harap masukkan nama Anda.");
        return;
    }

    if (type === 'Delivery' && !address) {
        showInlineAlert("Alamat wajib diisi untuk pesanan Delivery.");
        if (addressInput) addressInput.focus();
        return;
    }

    if (!paymentMethod) {
        showInlineAlert('Silakan pilih metode pembayaran terlebih dahulu.');
        return;
    }

    pendingOrder = { name, type, address, note };
    setOrderActionButton(paymentMethod === 'QRIS' ? 'Lanjutkan Pembayaran' : 'Kirim Pesanan', false);
    if (paymentMethod === 'QRIS') openQrisPaymentModal();
    else completeOrder();
}

function handlePaymentMethodChange() {
    const paymentMethod = document.getElementById('paymentMethod')?.value;
    if (!paymentMethod) return;

    if (paymentMethod === 'QRIS') {
        qrisPaymentConfirmed = false;
        qrisPaymentProofFile = null;
        resetQrisPaymentModal();
        return;
    }

    setOrderActionButton(paymentMethod === 'QRIS' ? 'Lanjutkan Pembayaran' : 'Kirim Pesanan', false);
}

function closeQrisPaymentModal() {
    const modal = document.getElementById('qrisPaymentModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

function openQrisPaymentModal() {
    const modal = document.getElementById('qrisPaymentModal');
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
}

function resetQrisPaymentModal() {
    document.getElementById('qrisStepScan')?.removeAttribute('hidden');
    document.getElementById('qrisStepProof')?.setAttribute('hidden', '');
    const input = document.getElementById('paymentProofInput');
    const fileName = document.getElementById('paymentProofFileName');
    if (input) input.value = '';
    if (fileName) fileName.textContent = 'Pilih foto bukti transfer';
}

function nextQrisPaymentStep() {
    document.getElementById('qrisStepScan')?.setAttribute('hidden', '');
    document.getElementById('qrisStepProof')?.removeAttribute('hidden');
}

function previousQrisPaymentStep() {
    document.getElementById('qrisStepProof')?.setAttribute('hidden', '');
    document.getElementById('qrisStepScan')?.removeAttribute('hidden');
}

function handlePaymentProofSelected(event) {
    const file = event.target.files?.[0];
    const fileName = document.getElementById('paymentProofFileName');
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
        event.target.value = '';
        qrisPaymentProofFile = null;
        showInlineAlert('Pilih foto JPG, PNG, atau WEBP dengan ukuran maksimal 5 MB.');
        return;
    }
    qrisPaymentProofFile = file;
    if (fileName) fileName.textContent = file.name;
}

function confirmQrisPayment() {
    if (!qrisPaymentProofFile) {
        showInlineAlert('Pilih foto bukti transfer terlebih dahulu.');
        return;
    }
    qrisPaymentConfirmed = true;
    closeQrisPaymentModal();
    completeOrder();
}

async function completeOrder() {
    if (orderSubmissionInProgress) return;
    orderSubmissionInProgress = true;
    const actionButton = document.getElementById('orderActionButton');
    if (actionButton) actionButton.disabled = true;

    if (!pendingOrder) {
        startOrderConfirmation();
        orderSubmissionInProgress = false;
        if (actionButton) actionButton.disabled = false;
        return;
    }

    const paymentMethod = document.getElementById('paymentMethod')?.value;
    if (!paymentMethod) {
        showInlineAlert('Silakan pilih metode pembayaran terlebih dahulu.');
        orderSubmissionInProgress = false;
        if (actionButton) actionButton.disabled = false;
        return;
    }

    if (paymentMethod === 'QRIS' && !qrisPaymentConfirmed) {
        openQrisPaymentModal();
        showInlineAlert('Selesaikan pembayaran QRIS dan unggah bukti transfer terlebih dahulu.');
        orderSubmissionInProgress = false;
        if (actionButton) actionButton.disabled = false;
        return;
    }

    const { name, type, address, note } = pendingOrder;

    const orderItems = Object.keys(cart).map(id => {
        const item = menuItems.find(menuItem => menuItem.id == id);
        return {
            product_id: item.id,
            product_name: item.name,
            quantity: cart[id],
            unit_price: item.price
        };
    });

    let total = 0;
    Object.keys(cart).forEach((id) => {
        const item = menuItems.find(m => m.id == id);
        const qty = cart[id];
        const sub = item.price * qty;
        total += sub;
    });

    if (paymentMethod === 'QRIS' && !supabaseClient) {
        showInlineAlert('Database belum terhubung, sehingga bukti transfer belum dapat dikirim.');
        orderSubmissionInProgress = false;
        if (actionButton) actionButton.disabled = false;
        return;
    }

    let paymentProofUrl = null;
    if (paymentMethod === 'QRIS') {
        const proofName = qrisPaymentProofFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const proofPath = `pending/${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}-${proofName}`;
        const { error: uploadError } = await supabaseClient.storage.from('payment-proofs').upload(proofPath, qrisPaymentProofFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: qrisPaymentProofFile.type
        });
        if (uploadError) {
            console.error('Bukti transfer gagal diunggah:', uploadError);
            showInlineAlert('Bukti transfer gagal diunggah. Pastikan bucket payment-proofs sudah dibuat.');
            orderSubmissionInProgress = false;
            if (actionButton) actionButton.disabled = false;
            return;
        }
        paymentProofUrl = supabaseClient.storage.from('payment-proofs').getPublicUrl(proofPath).data.publicUrl;
    }

    const saved = await saveOrderToDatabase({
        customer_name: name,
        order_type: type,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'QRIS' ? 'awaiting_verification' : 'cod_confirmed',
        payment_confirmed_at: paymentMethod === 'QRIS' ? null : new Date().toISOString(),
        payment_proof_url: paymentProofUrl,
        address: type === 'Delivery' ? address : null,
        note: note || null,
        total_amount: total,
        whatsapp_sent_at: null
    }, orderItems);

    if (!saved) {
        showInlineAlert('Pesanan gagal disimpan ke database. Jalankan database.sql terbaru lalu coba lagi.');
        orderSubmissionInProgress = false;
        if (actionButton) actionButton.disabled = false;
        return;
    }

    const orderedProducts = orderItems.map((item) => item.product_name);
    const purchasedProducts = JSON.parse(localStorage.getItem(PURCHASED_PRODUCTS_KEY)) || [];
    localStorage.setItem(PURCHASED_PRODUCTS_KEY, JSON.stringify([
        ...new Set([...purchasedProducts, ...orderedProducts])
    ]));
    addUserOrderRecord({
        id: saved.id,
        customer_name: name,
        order_type: type,
        address: type === 'Delivery' ? address : '-',
        note: note || '',
        total_amount: total,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'QRIS' ? 'awaiting_verification' : 'cod_confirmed',
        payment_proof_url: paymentProofUrl || '',
        status: 'new',
        items: orderItems.map((item) => ({
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price
        }))
    });
    cart = {};
    pendingOrder = null;
    qrisPaymentConfirmed = false;
    qrisPaymentProofFile = null;
    orderSubmissionInProgress = false;
    saveAndRefreshCart();
    showOrderReviewModal(orderedProducts);
}

function showOrderReviewModal(products) {
    const modal = document.getElementById('reviewOrderModal');
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
}

function closeOrderReviewModal() {
    const modal = document.getElementById('reviewOrderModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

function goToOrderReview() {
    window.location.href = 'review.html';
}

// BUKA PETUNJUK ARAH DI GOOGLE MAPS DARI LOKASI PENGGUNA
function openDirectionsTo(destLat, destLng) {
    if (!destLat || !destLng) return;

    // Jika browser tidak mendukung Geolocation, buka saja tujuan
    if (!navigator.geolocation) {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
        window.open(url, '_blank');
        return;
    }

    navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${destLat},${destLng}&travelmode=driving`;
        window.open(url, '_blank');
    }, (err) => {
        // Jika gagal mengambil lokasi, buka petunjuk arah ke tujuan saja
        const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
        alert('Tidak dapat mengambil lokasi Anda. Membuka petunjuk arah di Google Maps.');
        window.open(url, '_blank');
    }, { enableHighAccuracy: true, timeout: 10000 });
}

// BUKA PETUNJUK ARAH MENGGUNAKAN ALAMAT YANG DIINPUT PENGGUNA ATAU GEOLOCATION
function openDirectionsFromInput(destLat, destLng) {
    const input = document.getElementById('originAddressInput');
    const originAddr = input ? input.value.trim() : '';

    if (originAddr) {
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originAddr)}&destination=${destLat},${destLng}&travelmode=driving`;
        window.open(url, '_blank');
        return;
    }

    // Jika tidak ada alamat input, coba gunakan geolocation (fallback ke tujuan saja jika gagal)
    openDirectionsTo(destLat, destLng);
}


// ====== FUNGSI AKSES ADMIN TERSEMBUNYI ======

// Pasang listener ketuk 5x di pojok kiri atas setiap halaman
function setupAdminGateTrigger() {
    if (!document.getElementById('gateAdminTrigger')) return;

    document.addEventListener('click', (event) => {
        if (event.target.closest('.nav-hamburger, .nav-hamburger-panel')) return;
        if (event.clientX > 72 || event.clientY > 72) return;

        const now = Date.now();
        if (now - adminTapLastTime > ADMIN_TAP_WINDOW_MS) {
            adminTapCount = 0;
        }
        adminTapLastTime = now;
        adminTapCount += 1;

        if (adminTapCount >= ADMIN_TAP_TARGET) {
            adminTapCount = 0;
            openAdminGate();
        }
    });
}

function openAdminGate() {
    const overlay = document.getElementById('adminGateOverlay');
    if (!overlay) return;

    overlay.classList.add('active');
    const input = document.getElementById('adminGatePassword');
    const error = document.getElementById('adminGateError');
    if (error) error.textContent = '';
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 50);
    }
}

// Menutup gerbang password. Di admin.html, menutup gerbang tanpa berhasil
// login akan mengembalikan pengunjung ke halaman utama.
function closeAdminGate() {
    const overlay = document.getElementById('adminGateOverlay');
    if (!overlay) return;
    overlay.classList.remove('active');

    const dashboard = document.getElementById('adminDashboard');
    if (dashboard && sessionStorage.getItem(ADMIN_SESSION_KEY) !== 'true') {
        window.location.href = 'index.html';
    }
}

function submitAdminGate() {
    const input = document.getElementById('adminGatePassword');
    const error = document.getElementById('adminGateError');
    const value = input ? input.value.trim() : '';

    if (value !== ADMIN_PASSWORD) {
        if (error) error.textContent = 'Kata sandi salah. Coba lagi.';
        if (input) {
            input.value = '';
            input.focus();
        }
        return;
    }

    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');

    // Jika sudah berada di dashboard (admin.html), langsung buka kontennya.
    // Jika belum (misal dari layar loading di index.html), arahkan ke dashboard.
    const dashboard = document.getElementById('adminDashboard');
    if (dashboard) {
        unlockAdminDashboard();
    } else {
        window.location.href = 'admin.html';
    }
}

function setupAdminGateModal() {
    const overlay = document.getElementById('adminGateOverlay');
    if (!overlay) return;

    const closeBtn = document.getElementById('adminGateClose');
    const submitBtn = document.getElementById('adminGateSubmit');
    const input = document.getElementById('adminGatePassword');

    if (closeBtn) closeBtn.addEventListener('click', closeAdminGate);
    if (submitBtn) submitBtn.addEventListener('click', submitAdminGate);
    if (input) {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') submitAdminGate();
        });
    }
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeAdminGate();
    });
}

function unlockAdminDashboard() {
    const overlay = document.getElementById('adminGateOverlay');
    if (overlay) overlay.classList.remove('active');

    const dashboard = document.getElementById('adminDashboard');
    if (dashboard) dashboard.classList.add('is-visible');

    renderAdminReviews();
    renderAdminFeedback();
    renderAdminStats();
    loadAdminComments();
    loadAdminFeedback();
    loadAdminDatabaseData();
}

// Jalan khusus saat berada di admin.html: cek sesi, tampilkan dashboard
// atau munculkan gerbang password jika belum login.
function initAdminPage() {
    const dashboard = document.getElementById('adminDashboard');
    if (!dashboard) return;

    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true') {
        dashboard.classList.add('is-visible');
        renderAdminReviews();
        renderAdminFeedback();
        renderAdminStats();
        loadAdminComments();
        loadAdminFeedback();
        loadAdminDatabaseData();
    } else {
        openAdminGate();
    }
}

function adminLogout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.href = 'index.html';
}

function openAdminDataModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('review-popup-open');
}

function closeAdminDataModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.admin-data-modal.active')) document.body.classList.remove('review-popup-open');
}

function openAdminReviews() {
    renderAdminReviews();
    renderAdminFeedback();
    loadAdminFeedback();
    openAdminDataModal('adminReviewsModal');
}

function openAdminSales() {
    loadAdminDatabaseData();
    openAdminDataModal('adminSalesModal');
}

// Toast ringkas untuk aksi di dashboard admin (pakai gaya visual .inline-alert)
function showAdminToast(title, message, duration = 2600) {
    const existing = document.querySelector('.inline-alert');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = 'inline-alert';
    el.innerHTML = '<strong></strong><span></span>';
    el.querySelector('strong').textContent = title;
    el.querySelector('span').textContent = message;
    el.setAttribute('role', 'status');
    el.addEventListener('click', () => {
        el.classList.add('hide');
        setTimeout(() => el.remove(), 220);
    });
    document.body.appendChild(el);

    el._hideTimer = setTimeout(() => {
        el.classList.add('hide');
        setTimeout(() => el.remove(), 220);
    }, duration);
}

function renderAdminFeedback() {
    const containers = [
        document.getElementById('adminDashboardFeedbackList'),
        document.getElementById('adminFeedbackList')
    ].filter(Boolean);

    if (!containers.length) return;

    containers.forEach((list) => {
        list.innerHTML = '';

        if (adminDatabaseFeedback.length > 0) {
            adminDatabaseFeedback.forEach((item) => {
                const row = document.createElement('div');
                row.className = 'admin-review-row';
                row.innerHTML = `
                    <div class="admin-review-info">
                        <div class="admin-review-top">
                            <strong></strong>
                            <span class="admin-review-stars">Kritik & Saran</span>
                        </div>
                        <div class="admin-review-food"></div>
                        <p class="admin-review-message"></p>
                        <small class="admin-review-status"></small>
                    </div>
                `;
                row.querySelector('strong').textContent = item.name;
                row.querySelector('.admin-review-food').textContent = item.contact;
                row.querySelector('.admin-review-message').textContent = item.message;
                row.querySelector('.admin-review-status').textContent = `Status: ${item.status}`;
                list.appendChild(row);
            });
            return;
        }

        list.innerHTML = '<p class="review-empty">Belum ada kritik & saran.</p>';
    });
}

function renderAdminReviews() {
    const list = document.getElementById('adminReviewList');
    if (!list) return;

    if (adminDatabaseComments.length > 0) {
        list.innerHTML = '';
        adminDatabaseComments.forEach((comment) => {
            const row = document.createElement('div');
            row.className = 'admin-review-row';
            row.innerHTML = `
                <div class="admin-review-info">
                    <div class="admin-review-top">
                        <strong></strong>
                        <span class="admin-review-stars"></span>
                    </div>
                    <div class="admin-review-food"></div>
                    <p class="admin-review-message"></p>
                    <small class="admin-review-status"></small>
                </div>
                <div class="admin-review-actions"></div>
            `;
            row.querySelector('strong').textContent = comment.name;
            row.querySelector('.admin-review-stars').textContent = '★'.repeat(comment.rating) + '☆'.repeat(5 - comment.rating);
            row.querySelector('.admin-review-food').textContent = comment.food;
            row.querySelector('.admin-review-message').textContent = comment.message;
            row.querySelector('.admin-review-status').textContent = `Status: ${comment.status}`;

            const actions = row.querySelector('.admin-review-actions');
            if (comment.status === 'pending') {
                const approveButton = document.createElement('button');
                approveButton.className = 'admin-review-approve';
                approveButton.type = 'button';
                approveButton.innerHTML = '<i class="fa-solid fa-check"></i> Approve';
                approveButton.addEventListener('click', () => approveAdminComment(comment.id, approveButton));
                actions.appendChild(approveButton);

                const declineButton = document.createElement('button');
                declineButton.className = 'admin-review-decline';
                declineButton.type = 'button';
                declineButton.innerHTML = '<i class="fa-solid fa-xmark"></i> Decline';
                declineButton.addEventListener('click', () => declineAdminComment(comment.id, declineButton));
                actions.appendChild(declineButton);
            }
            const deleteButton = document.createElement('button');
            deleteButton.className = 'admin-review-delete';
            deleteButton.type = 'button';
            deleteButton.setAttribute('aria-label', 'Hapus komentar');
            deleteButton.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            deleteButton.addEventListener('click', () => deleteAdminComment(comment.id));
            actions.appendChild(deleteButton);
            list.appendChild(row);
        });
        return;
    }

    const storedReviews = JSON.parse(localStorage.getItem('umkm_reviews')) || [];
    const reviews = storedReviews.length > 0 ? storedReviews : DEFAULT_REVIEWS;
    list.innerHTML = '';

    if (reviews.length === 0) {
        list.innerHTML = '<p class="review-empty">Belum ada review.</p>';
        return;
    }

    reviews.forEach((review, index) => {
        const row = document.createElement('div');
        row.className = 'admin-review-row';
        row.innerHTML = `
            <div class="admin-review-info">
                <div class="admin-review-top">
                    <strong></strong>
                    <span class="admin-review-stars"></span>
                </div>
                <div class="admin-review-food"></div>
                <p class="admin-review-message"></p>
            </div>
            <button class="admin-review-delete" type="button" aria-label="Hapus review">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        row.querySelector('strong').textContent = review.name;
        row.querySelector('.admin-review-stars').textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
        row.querySelector('.admin-review-food').textContent = review.food;
        row.querySelector('.admin-review-message').textContent = review.message;
        row.querySelector('.admin-review-delete').addEventListener('click', () => deleteAdminReview(index));
        list.appendChild(row);
    });
}

function deleteAdminReview(index) {
    const storedReviews = JSON.parse(localStorage.getItem('umkm_reviews')) || [];
    const reviews = storedReviews.length > 0 ? storedReviews : [...DEFAULT_REVIEWS];
    reviews.splice(index, 1);
    localStorage.setItem('umkm_reviews', JSON.stringify(reviews));
    renderAdminReviews();
    renderAdminStats();
    showAdminToast('Berhasil', 'Review telah dihapus.');
}

function openAdminConfirm(title, message, action) {
    const modal = document.getElementById('adminConfirmModal');
    const titleElement = document.getElementById('adminConfirmTitle');
    const messageElement = document.getElementById('adminConfirmMessage');
    const submitButton = document.getElementById('adminConfirmSubmit');
    if (!modal || !titleElement || !messageElement || !submitButton) return;

    titleElement.textContent = title;
    messageElement.textContent = message;
    adminConfirmAction = action;
    submitButton.onclick = async () => {
        const currentAction = adminConfirmAction;
        closeAdminConfirm();
        if (currentAction) await currentAction();
    };
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
}

function closeAdminConfirm() {
    const modal = document.getElementById('adminConfirmModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    adminConfirmAction = null;
}

function renderAdminStats() {
    const storedReviews = JSON.parse(localStorage.getItem('umkm_reviews')) || [];
    const reviews = storedReviews.length > 0 ? storedReviews : DEFAULT_REVIEWS;
    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) : 0;
    const totalMenu = menuItems.filter(item => !item.comingSoon).length;

    const statTotalReviews = document.getElementById('statTotalReviews');
    const statAvgRating = document.getElementById('statAvgRating');
    const statTotalMenu = document.getElementById('statTotalMenu');

    if (statTotalReviews) statTotalReviews.textContent = totalReviews;
    if (statAvgRating) statAvgRating.textContent = avgRating.toFixed(1);
    if (statTotalMenu) statTotalMenu.textContent = totalMenu;
}

async function loadAdminDatabaseData() {
    const status = document.getElementById('databaseStatus');
    const ordersList = document.getElementById('databaseOrdersList');
    if (!status || !ordersList) return;

    if (!supabaseClient) {
        status.textContent = 'Supabase belum dikonfigurasi. Isi supabase-config.js terlebih dahulu.';
        return;
    }

    const [dashboardResult, ordersResult, menuSalesResult] = await Promise.all([
        supabaseClient.from('admin_dashboard').select('*').single(),
        supabaseClient.from('sales_orders').select('id, created_at, customer_name, order_type, address, status, delivery_confirmation, payment_method, payment_status, payment_proof_url, total_amount').order('created_at', { ascending: false }).limit(1000),
        supabaseClient.from('menu_sales_summary').select('product_name, total_quantity, total_sales').order('total_sales', { ascending: false })
    ]);

    if (dashboardResult.error || ordersResult.error || menuSalesResult.error) {
        status.textContent = 'Database terhubung, tetapi belum bisa dibaca. Jalankan database.sql dan periksa policy Supabase.';
        console.error('Data dashboard gagal dimuat:', dashboardResult.error || ordersResult.error || menuSalesResult.error);
        return;
    }

    const summary = dashboardResult.data;
    document.getElementById('dbTotalClicks').textContent = summary.total_link_clicks ?? 0;
    document.getElementById('dbTotalOrders').textContent = summary.total_orders ?? 0;
    document.getElementById('dbTotalSales').textContent = `Rp ${Number(summary.total_sales || 0).toLocaleString('id-ID')}`;
    const normalizedSearch = adminOrderSearchQuery.trim().toLowerCase();
    const searchedOrders = ordersResult.data.filter((order) => {
        if (!normalizedSearch) return true;
        return String(order.id).toLowerCase().includes(normalizedSearch) || String(order.customer_name || '').toLowerCase().includes(normalizedSearch);
    });
    const filteredOrders = searchedOrders.filter((order) => {
        if (adminOrderStatusFilter === 'completed') return ['delivered', 'completed'].includes(order.status);
        if (adminOrderStatusFilter === 'delivery_issue') return order.delivery_confirmation === 'not_received';
        if (adminOrderStatusFilter === 'cancelled') return order.status === 'cancelled';
        if (adminOrderStatusFilter === 'processing') return !['delivered', 'completed', 'cancelled'].includes(order.status);
        return true;
    });
    const compactOrderLimit = 5;
    const visibleOrders = adminOrderExpanded ? filteredOrders : filteredOrders.slice(0, compactOrderLimit);
    status.textContent = `Terakhir diperbarui ${new Date().toLocaleString('id-ID')}. Menampilkan ${visibleOrders.length} dari ${filteredOrders.length} pesanan${normalizedSearch || adminOrderStatusFilter !== 'all' ? ' yang cocok' : ''}.`;

    const menuSalesList = document.getElementById('menuSalesList');
    if (menuSalesList) {
        menuSalesList.innerHTML = menuSalesResult.data.length ? menuSalesResult.data.map((item) => `
            <div class="menu-sales-row">
                <div><strong>${item.product_name}</strong><span>${Number(item.total_quantity || 0)} terjual</span></div>
                <strong>Rp ${Number(item.total_sales || 0).toLocaleString('id-ID')}</strong>
            </div>
        `).join('') : '<p class="admin-empty-state">Belum ada data penjualan menu.</p>';
    }

    const isMobileOrderList = window.innerWidth <= 599;
    ordersList.classList.toggle('mobile-order-list', isMobileOrderList);
    ordersList.innerHTML = '';

    if (!filteredOrders.length) {
        if (isMobileOrderList) {
            ordersList.innerHTML = '<div class="admin-mobile-order-empty">Belum ada pesanan di database.</div>';
        } else {
            ordersList.innerHTML = '<tr><td colspan="9">Belum ada pesanan di database.</td></tr>';
        }
        updateAdminOrderExpandButton(0);
        return;
    }

    if (isMobileOrderList) {
        visibleOrders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'admin-mobile-order-card';

            const header = document.createElement('div');
            header.className = 'mobile-order-header';
            header.innerHTML = `
                <div class="mobile-order-header-main">
                    <strong>#${String(order.id).slice(0, 8).toUpperCase()}</strong>
                    <span>${order.customer_name || '-'}</span>
                </div>
                <button type="button" class="admin-order-collapse-btn mobile-order-toggle">
                    <i class="fa-solid fa-chevron-up"></i> Minimalkan
                </button>
            `;

            const details = document.createElement('div');
            details.className = 'mobile-order-details';
            details.innerHTML = `
                <div class="mobile-order-row"><span>Waktu</span><strong>${new Date(order.created_at).toLocaleString('id-ID')}</strong></div>
                <div class="mobile-order-row"><span>Pesanan</span><strong>${order.order_type || '-'}</strong></div>
                <div class="mobile-order-row"><span>Alamat</span><strong>${order.address || '-'}</strong></div>
                <div class="mobile-order-row"><span>Status</span><strong>${order.delivery_confirmation === 'not_received' ? 'Belum sampai' : formatOrderStatus(order.status)}</strong></div>
                <div class="mobile-order-row"><span>Pembayaran</span><strong>${order.payment_status === 'paid' ? 'Sudah masuk' : order.payment_method === 'QRIS' ? 'Menunggu verifikasi' : 'COD'}</strong></div>
                <div class="mobile-order-row"><span>Total</span><strong>Rp ${Number(order.total_amount || 0).toLocaleString('id-ID')}</strong></div>
            `;

            const actions = document.createElement('div');
            actions.className = 'mobile-order-actions';

            const statusSelect = document.createElement('select');
            statusSelect.className = 'admin-order-status-select';
            ORDER_STATUS_STEPS.concat(['confirmed', 'completed', 'cancelled']).forEach((statusValue) => {
                const option = document.createElement('option');
                option.value = statusValue;
                option.textContent = formatOrderStatus(statusValue);
                option.selected = order.status === statusValue;
                statusSelect.appendChild(option);
            });
            statusSelect.addEventListener('change', () => updateAdminOrderStatus(order.id, statusSelect.value));
            actions.appendChild(statusSelect);

            if (order.payment_proof_url) {
                const proofLink = document.createElement('button');
                proofLink.type = 'button';
                proofLink.className = 'admin-proof-link';
                proofLink.innerHTML = '<i class="fa-solid fa-image"></i> Lihat bukti';
                proofLink.addEventListener('click', () => openPaymentProofModal(order.payment_proof_url));
                actions.appendChild(proofLink);
            }
            if (order.payment_method === 'QRIS' && order.payment_status !== 'paid') {
                const verifyButton = document.createElement('button');
                verifyButton.type = 'button';
                verifyButton.className = 'admin-payment-confirm-btn';
                verifyButton.innerHTML = '<i class="fa-solid fa-check"></i> Sudah masuk';
                verifyButton.addEventListener('click', () => verifyPaymentOrder(order.id));
                actions.appendChild(verifyButton);
            }
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'admin-order-delete-btn';
            deleteButton.innerHTML = '<i class="fa-solid fa-trash-can"></i> Hapus';
            deleteButton.addEventListener('click', () => {
                openAdminConfirm(
                    'Hapus pesanan?',
                    `Pesanan ${String(order.id).slice(0, 8).toUpperCase()} milik ${order.customer_name} akan dihapus permanen.`,
                    () => deleteAdminOrder(order.id)
                );
            });
            actions.appendChild(deleteButton);

            const toggleButton = header.querySelector('.mobile-order-toggle');
            toggleButton.addEventListener('click', () => {
                const isCollapsed = card.classList.toggle('is-collapsed');
                toggleButton.innerHTML = isCollapsed
                    ? '<i class="fa-solid fa-chevron-down"></i> Buka detail'
                    : '<i class="fa-solid fa-chevron-up"></i> Minimalkan';
            });

            card.appendChild(header);
            card.appendChild(details);
            card.appendChild(actions);
            ordersList.appendChild(card);
        });
        updateAdminOrderExpandButton(filteredOrders.length);
        return;
    }

    visibleOrders.forEach(order => {
        const row = document.createElement('tr');
        const basicCells = [
            String(order.id).slice(0, 8).toUpperCase(),
            new Date(order.created_at).toLocaleString('id-ID'),
            order.customer_name,
            order.order_type,
            order.address || '-'
        ];
        basicCells.forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.appendChild(cell);
        });
        const statusCell = document.createElement('td');
        if (order.delivery_confirmation === 'not_received') {
            const issueLabel = document.createElement('strong');
            issueLabel.className = 'admin-delivery-issue';
            issueLabel.textContent = 'Belum sampai';
            statusCell.appendChild(issueLabel);
        }
        const statusSelect = document.createElement('select');
        statusSelect.className = 'admin-order-status-select';
        ORDER_STATUS_STEPS.concat(['confirmed', 'completed', 'cancelled']).forEach((statusValue) => {
            const option = document.createElement('option');
            option.value = statusValue;
            option.textContent = formatOrderStatus(statusValue);
            option.selected = order.status === statusValue;
            statusSelect.appendChild(option);
        });
        statusSelect.addEventListener('change', () => updateAdminOrderStatus(order.id, statusSelect.value));
        statusCell.appendChild(statusSelect);
        row.appendChild(statusCell);
        [
            order.payment_status === 'paid' ? 'Sudah masuk' : order.payment_method === 'QRIS' ? 'Menunggu verifikasi' : 'COD',
            `Rp ${Number(order.total_amount || 0).toLocaleString('id-ID')}`
        ].forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.appendChild(cell);
        });
        const actionCell = document.createElement('td');
        if (order.payment_proof_url) {
            const proofLink = document.createElement('button');
            proofLink.type = 'button';
            proofLink.className = 'admin-proof-link';
            proofLink.innerHTML = '<i class="fa-solid fa-image"></i> Lihat bukti';
            proofLink.addEventListener('click', () => openPaymentProofModal(order.payment_proof_url));
            actionCell.appendChild(proofLink);
        }
        if (order.payment_method === 'QRIS' && order.payment_status !== 'paid') {
            const verifyButton = document.createElement('button');
            verifyButton.type = 'button';
            verifyButton.className = 'admin-payment-confirm-btn';
            verifyButton.innerHTML = '<i class="fa-solid fa-check"></i> Sudah masuk';
            verifyButton.addEventListener('click', () => verifyPaymentOrder(order.id));
            actionCell.appendChild(verifyButton);
        }
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'admin-order-delete-btn';
        deleteButton.innerHTML = '<i class="fa-solid fa-trash-can"></i> Hapus';
        deleteButton.addEventListener('click', () => {
            openAdminConfirm(
                'Hapus pesanan?',
                `Pesanan ${String(order.id).slice(0, 8).toUpperCase()} milik ${order.customer_name} akan dihapus permanen.`,
                () => deleteAdminOrder(order.id)
            );
        });
        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);
        ordersList.appendChild(row);
    });
    updateAdminOrderExpandButton(filteredOrders.length);
}

async function deleteAdminOrder(orderId) {
    if (!supabaseClient || !orderId) return;
    const { error } = await supabaseClient.from('sales_orders').delete().eq('id', orderId);
    if (error) {
        console.error('Pesanan gagal dihapus:', error);
        showAdminToast('Database', `Pesanan gagal dihapus: ${error.message}`);
        return;
    }
    showAdminToast('Berhasil', 'Pesanan telah dihapus.');
    await loadAdminDatabaseData();
}

function updateAdminOrderExpandButton(totalRows) {
    const button = document.getElementById('adminOrderExpandButton');
    if (!button) return;
    button.hidden = totalRows <= 5;
    button.classList.toggle('is-expanded', adminOrderExpanded);
    button.innerHTML = adminOrderExpanded
        ? '<i class="fa-solid fa-chevron-up"></i> Tampilkan lebih sedikit'
        : '<i class="fa-solid fa-chevron-down"></i> Tampilkan lebih banyak';
}

async function verifyPaymentOrder(orderId) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.from('sales_orders').update({
        payment_status: 'paid',
        payment_confirmed_at: new Date().toISOString(),
        status: 'confirmed'
    }).eq('id', orderId);
    if (error) {
        console.error('Status pembayaran gagal diperbarui:', error);
        showAdminToast('Database', `Verifikasi gagal: ${error.message}`);
        return;
    }
    showAdminToast('Berhasil', 'Dana ditandai sudah masuk.');
    await loadAdminDatabaseData();
}

function adminResetCart() {
    localStorage.removeItem('umkm_cart');
    cart = {};
    updateCartUI();
    showAdminToast('Berhasil', 'Keranjang belanja sudah dikosongkan.');
}

function adminResetReviews() {
    localStorage.removeItem('umkm_reviews');
    renderAdminReviews();
    renderAdminStats();
    showAdminToast('Berhasil', 'Review dikembalikan ke data contoh.');
}

// RUN SAAT LOKASI KATEGORI/SEARCH
function filterCategory(cat, btn) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const searchInput = document.getElementById('menuSearchInput');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const filteredItems = menuItems.filter((item) => {
        const matchesCategory = cat === 'semua' || item.category === cat;
        const searchableText = `${item.name} ${item.category} ${item.shortDesc}`.toLowerCase();
        return matchesCategory && (!query || searchableText.includes(query));
    });
    renderMenu(filteredItems);
}

function filterMenuBySearch(query) {
    const normalizedQuery = query.trim().toLowerCase();
    const activeCategory = document.querySelector('.cat-btn.active')?.textContent.trim().toLowerCase();
    const category = activeCategory === 'makanan' || activeCategory === 'minuman' ? activeCategory : 'semua';
    const filteredItems = menuItems.filter((item) => {
        const matchesCategory = category === 'semua' || item.category === category;
        const searchableText = `${item.name} ${item.category} ${item.shortDesc}`.toLowerCase();
        return matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
    renderMenu(filteredItems);
}

function setupMenuSearch() {
    const menuSearchInput = document.getElementById('menuSearchInput');
    if (menuSearchInput) {
        const query = new URLSearchParams(window.location.search).get('search') || '';
        menuSearchInput.value = query;
        menuSearchInput.addEventListener('input', () => filterMenuBySearch(menuSearchInput.value));
    }

    const homeSearchForm = document.getElementById('homeSearchForm');
    const homeSearchInput = document.getElementById('homeSearchInput');
    if (homeSearchForm && homeSearchInput) {
        homeSearchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const query = homeSearchInput.value.trim();
            if (query === ADMIN_SECRET_CODE) {
                sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
                window.location.href = 'admin.html';
                return;
            }
            window.location.href = `menu.html${query ? `?search=${encodeURIComponent(query)}` : ''}`;
        });
    }
}

// INIT
document.addEventListener("DOMContentLoaded", () => {
    applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
    setupHamburgerNavigation();
    recordAudienceClick();
    loadCommentsFromDatabase();

    const websiteQr = document.getElementById('websiteQr');
    if (websiteQr) {
        websiteQr.innerHTML = '<img src="QRweb.png" alt="QR code website Penagisa Food Corner" />';
        websiteQr.style.setProperty('--qr-foreground', getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#8d1e3d');
        websiteQr.style.setProperty('--qr-background', getComputedStyle(document.documentElement).getPropertyValue('--bg-white').trim() || '#ffffff');
    }

    const activeLink = document.querySelector('.nav-link.active');
    const navIndicator = document.querySelector('.nav-indicator');
    if (activeLink && navIndicator) {
        const navLinks = [...document.querySelectorAll('.nav-link')];
        const previousHref = sessionStorage.getItem('umkm_previous_nav');
        const previousLink = navLinks.find(link => link.getAttribute('href') === previousHref);

        navIndicator.classList.add('prepare');
        navIndicator.style.left = `${activeLink.offsetLeft}px`;
        navIndicator.style.width = `${activeLink.offsetWidth}px`;
        if (previousLink && previousLink !== activeLink) {
            navIndicator.style.left = `${previousLink.offsetLeft}px`;
        }
        void navIndicator.offsetWidth;
        navIndicator.classList.remove('prepare');
        navIndicator.classList.add('is-ready');

        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                sessionStorage.setItem('umkm_previous_nav', activeLink.getAttribute('href'));
            });
        });

        if (previousLink && previousLink !== activeLink) {
            requestAnimationFrame(() => {
                navIndicator.style.left = `${activeLink.offsetLeft}px`;
            });
        }
    }

    setupAdminGateTrigger();
    setupAdminGateModal();
    initAdminPage();

    const gate = document.getElementById('gateScreen');

    if (gate && !sessionStorage.getItem('umkm_gate_shown')) {
        sessionStorage.setItem('umkm_gate_shown', 'true');
        window.setTimeout(() => {
            gate.classList.remove('is-hidden');
            document.body.classList.add('gate-open');
            startMenuIntro(gate);
        }, 500);
    } else if (gate) {
        gate.classList.add('is-hidden');
        document.body.classList.remove('gate-open');
    }

    const orderType = document.getElementById('orderType');
    if (orderType) {
        orderType.addEventListener('change', updateOrderTypeFields);
        updateOrderTypeFields();
    }

    setupMenuSearch();
    syncRatings();
    renderMenu(menuItems);
    const menuSearchInput = document.getElementById('menuSearchInput');
    if (menuSearchInput && menuSearchInput.value) filterMenuBySearch(menuSearchInput.value);
    setupReviewForm();
    renderReviews();
    document.querySelectorAll('[data-close-review-thank-you]').forEach((button) => {
        button.addEventListener('click', closeReviewThankYou);
    });
    const cartModal = document.getElementById('cartModal');
    if (cartModal) {
        cartModal.addEventListener('click', (event) => {
            if (event.target === cartModal) closeCartModal();
        });
    }
    const floatingCart = document.getElementById('floatingCart');
    if (floatingCart) {
        floatingCart.addEventListener('click', handleCartSummaryClick);
    }
    const adminOrderSearch = document.getElementById('adminOrderSearch');
    if (adminOrderSearch) {
        adminOrderSearch.addEventListener('input', () => {
            adminOrderSearchQuery = adminOrderSearch.value;
            loadAdminDatabaseData();
        });
    }
    const adminOrderStatusFilterSelect = document.getElementById('adminOrderStatusFilter');
    if (adminOrderStatusFilterSelect) {
        adminOrderStatusFilterSelect.addEventListener('change', () => {
            adminOrderStatusFilter = adminOrderStatusFilterSelect.value;
            loadAdminDatabaseData();
        });
    }
    const adminOrderExpandButton = document.getElementById('adminOrderExpandButton');
    if (adminOrderExpandButton) {
        adminOrderExpandButton.addEventListener('click', () => {
            adminOrderExpanded = !adminOrderExpanded;
            loadAdminDatabaseData();
        });
    }
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        closeReviewThankYou();
        closeCartModal();
        closeProductModal();
        closeAdminGate();
        closeOrderStatus();
        closeAdminDataModal('adminReviewsModal');
        closeAdminDataModal('adminSalesModal');
    });
    updateCartUI();
    refreshUserOrdersFromDatabase();
    if (Object.keys(cart).length > 0) refreshCartActivity();
    // Setup orderType visibility handling (show address only for Delivery)
    const orderSelect = document.getElementById('orderType');
    const addressGroup = document.getElementById('addressGroup');
    const addressLabel = document.getElementById('addressLabel');
    function updateAddressVisibility() {
        if (!orderSelect || !addressGroup) return;
        if (orderSelect.value === 'Delivery') {
            addressGroup.style.display = '';
            if (addressLabel) addressLabel.textContent = 'ALAMAT LENGKAP';
        } else {
            addressGroup.style.display = 'none';
        }
    }
    if (orderSelect) {
        orderSelect.addEventListener('change', updateAddressVisibility);
        updateAddressVisibility();
    }

    setupHamburgerNavigation();
    setupGalleryPage();
});

// GALLERY MENU
// Foto diambil dari menuItems supaya gallery selalu sama dengan menu yang dijual.
// Menu "segera hadir" tidak ditampilkan. Ganti foto lewat array images di menuItems.
function setupGalleryPage() {
    const list = document.getElementById('galeriList');
    const lightbox = document.getElementById('galeriLightbox');
    if (!list || !lightbox) return;

    const countLabel = document.getElementById('galeriCount');
    const emptyState = document.getElementById('galeriEmpty');
    const emptyText = document.getElementById('galeriEmptyText');
    const orderButton = document.getElementById('galeriOrderButton');
    const chips = document.querySelectorAll('[data-galeri-menu]');
    const lbImage = document.getElementById('galeriLbImage');
    const lbCaption = document.getElementById('galeriLbCaption');
    const lbClose = lightbox.querySelector('.galeri-lb-close');
    const lbPrev = lightbox.querySelector('.galeri-lb-prev');
    const lbNext = lightbox.querySelector('.galeri-lb-next');

    let activeMenu = '1';
    let openPhotos = [];
    let openIndex = 0;
    let lastTrigger = null;
    let loadToken = 0;

    const available = menuItems.filter((item) => (
        !item.comingSoon && Array.isArray(item.images) && item.images.length > 0
    ));

    function updateSetCount(set) {
        const total = set.querySelectorAll('.galeri-photo').length;
        set.dataset.count = total > 3 ? 'many' : String(total);
    }

    function refresh() {
        const sets = Array.from(list.querySelectorAll('.galeri-set'));
        let visibleSets = 0;
        let visiblePhotos = 0;

        sets.forEach((set) => {
            const show = activeMenu === 'semua' || set.dataset.menuId === activeMenu;
            set.hidden = !show;
            if (show) {
                visibleSets += 1;
                visiblePhotos += set.querySelectorAll('.galeri-photo').length;
            }
        });

        countLabel.textContent = visiblePhotos ? `${visiblePhotos} foto menu ditampilkan` : '';
        if (orderButton) {
            const selectedItem = available.find((item) => String(item.id) === activeMenu);
            orderButton.href = selectedItem
                ? `menu.html?search=${encodeURIComponent(selectedItem.name)}`
                : 'menu.html';
            orderButton.setAttribute('aria-label', selectedItem ? `Pesan ${selectedItem.name}` : 'Buka halaman pesanan');
        }
        emptyState.hidden = visibleSets > 0;
        if (visibleSets === 0) {
            emptyText.textContent = sets.length === 0 && activeMenu === 'semua'
                ? 'Foto akan tampil di sini setelah menu ditambahkan.'
                : 'Belum ada foto untuk menu ini.';
        }
    }

    function buildPhoto(item, set, src, photoIndex, isFirstOnPage) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'galeri-photo';
        button.setAttribute('aria-haspopup', 'dialog');

        const img = new Image();
        img.alt = `${item.name}, foto ${photoIndex + 1}`;
        img.decoding = 'async';
        img.loading = 'eager';
        img.fetchPriority = isFirstOnPage ? 'high' : 'auto';

        img.addEventListener('load', () => img.classList.add('is-loaded'));
        img.addEventListener('error', () => {
            if (img.dataset.fallbackUsed === 'true') return;
            img.dataset.fallbackUsed = 'true';
            img.src = item.images[0];
        });

        img.src = src;
        if (img.complete && img.naturalWidth > 0) img.classList.add('is-loaded');

        button.appendChild(img);
        return button;
    }

    function buildSet(item, index) {
        const set = document.createElement('section');
        set.className = index % 2 === 1 ? 'galeri-set is-flipped' : 'galeri-set';
        set.dataset.category = item.category;
        set.dataset.menuId = String(item.id);

        const headingId = `galeriNama${item.id}`;
        set.setAttribute('aria-labelledby', headingId);

        const head = document.createElement('div');
        head.className = 'galeri-set-head';

        const titleWrap = document.createElement('div');
        const title = document.createElement('h2');
        title.id = headingId;
        title.textContent = item.name;
        const meta = document.createElement('p');
        meta.className = 'galeri-set-meta';
        meta.textContent = item.category.charAt(0).toUpperCase() + item.category.slice(1);
        titleWrap.append(title, meta);

        const side = document.createElement('div');
        side.className = 'galeri-set-side';
        if (item.price > 0) {
            const price = document.createElement('span');
            price.className = 'galeri-price';
            price.textContent = `Rp ${item.price.toLocaleString('id-ID')}`;
            side.appendChild(price);
        }
        const order = document.createElement('a');
        order.className = 'galeri-order';
        order.href = `menu.html?search=${encodeURIComponent(item.name)}`;
        order.textContent = 'Pesan';
        order.setAttribute('aria-label', `Pesan ${item.name}`);
        side.appendChild(order);

        head.append(titleWrap, side);

        const photos = document.createElement('div');
        photos.className = 'galeri-photos';
        item.images.slice(0, 4).forEach((src, photoIndex) => {
            photos.appendChild(buildPhoto(item, set, src, photoIndex, index === 0 && photoIndex === 0));
        });

        set.append(head, photos);
        updateSetCount(set);
        return set;
    }

    available.forEach((item, index) => list.appendChild(buildSet(item, index)));

    chips.forEach((chip) => {
        chip.addEventListener('click', () => {
            activeMenu = chip.dataset.galeriMenu;
            chips.forEach((other) => other.setAttribute('aria-pressed', String(other === chip)));
            refresh();
        });
    });

    refresh();

    // ---- Lightbox ----
    function fullSize(src) {
        return src.replace(/([?&])w=\d+/, '$1w=1600');
    }

    function showPhoto(index) {
        openIndex = (index + openPhotos.length) % openPhotos.length;
        const button = openPhotos[openIndex];
        const img = button.querySelector('img');
        const small = img.currentSrc || img.src;
        const large = fullSize(small);
        const token = ++loadToken;

        lbImage.src = small;
        lbImage.alt = img.alt;
        lbCaption.textContent = button.closest('.galeri-set').querySelector('h2').textContent;

        // Tampilkan foto kecil dulu (sudah ada di cache), lalu ganti dengan versi tajam.
        if (large !== small) {
            const loader = new Image();
            loader.onload = () => {
                if (token === loadToken) lbImage.src = large;
            };
            loader.src = large;
        }
    }

    function openLightbox(button) {
        openPhotos = Array.from(list.querySelectorAll('.galeri-set:not([hidden]) .galeri-photo'));
        openIndex = openPhotos.indexOf(button);
        lastTrigger = button;
        lbPrev.hidden = openPhotos.length < 2;
        lbNext.hidden = openPhotos.length < 2;
        lightbox.hidden = false;
        document.body.classList.add('galeri-lock');
        showPhoto(openIndex);
        lbClose.focus();
    }

    function closeLightbox() {
        if (lightbox.hidden) return;
        lightbox.hidden = true;
        document.body.classList.remove('galeri-lock');
        loadToken += 1;
        lbImage.removeAttribute('src');
        if (lastTrigger && document.body.contains(lastTrigger)) lastTrigger.focus();
    }

    list.addEventListener('click', (event) => {
        const button = event.target.closest('.galeri-photo');
        if (button) openLightbox(button);
    });

    lbClose.addEventListener('click', closeLightbox);
    lbPrev.addEventListener('click', () => showPhoto(openIndex - 1));
    lbNext.addEventListener('click', () => showPhoto(openIndex + 1));
    lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', (event) => {
        if (lightbox.hidden) return;
        if (event.key === 'Escape') {
            closeLightbox();
        } else if (event.key === 'ArrowLeft' && openPhotos.length > 1) {
            showPhoto(openIndex - 1);
        } else if (event.key === 'ArrowRight' && openPhotos.length > 1) {
            showPhoto(openIndex + 1);
        } else if (event.key === 'Tab') {
            const focusable = [lbClose, lbPrev, lbNext].filter((button) => !button.hidden);
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!focusable.includes(document.activeElement)) {
                event.preventDefault();
                first.focus();
            } else if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    let touchStartX = null;
    lightbox.addEventListener('touchstart', (event) => {
        touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });
    lightbox.addEventListener('touchend', (event) => {
        if (touchStartX === null) return;
        const distance = event.changedTouches[0].clientX - touchStartX;
        touchStartX = null;
        if (Math.abs(distance) > 50 && openPhotos.length > 1) {
            showPhoto(openIndex + (distance < 0 ? 1 : -1));
        }
    }, { passive: true });
}

function setupHamburgerNavigation() {
    const navContainer = document.querySelector('.nav-container');
    if (!navContainer) return;

    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) navMenu.style.display = 'none';

    let hamburgerButton = document.querySelector('.nav-hamburger');
    if (!hamburgerButton) {
        hamburgerButton = document.createElement('button');
        hamburgerButton.type = 'button';
        hamburgerButton.className = 'nav-hamburger';
        hamburgerButton.setAttribute('aria-label', 'Buka menu utama');
        hamburgerButton.setAttribute('title', 'Buka menu utama');
        hamburgerButton.setAttribute('aria-expanded', 'false');
        hamburgerButton.innerHTML = `
            <span class="nav-hamburger-box" aria-hidden="true">
                <span class="nav-hamburger-line"></span>
                <span class="nav-hamburger-line"></span>
                <span class="nav-hamburger-line"></span>
            </span>
        `;
        navContainer.insertBefore(hamburgerButton, navContainer.firstChild);
    }

    let mobileNavPanel = document.querySelector('.nav-hamburger-panel');
    if (!mobileNavPanel) {
        mobileNavPanel = document.createElement('div');
        mobileNavPanel.className = 'nav-hamburger-panel';
        mobileNavPanel.setAttribute('aria-hidden', 'true');

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'nav-hamburger-close';
        closeButton.setAttribute('aria-label', 'Tutup menu utama');
        closeButton.setAttribute('title', 'Tutup menu utama');
        closeButton.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
        mobileNavPanel.appendChild(closeButton);

        const pages = [
            { text: 'Home', href: 'index.html' },
            { text: 'Menu', href: 'menu.html' },
            { text: 'Info', href: 'info.html' },
            { text: 'Gallery', href: 'gallery.html' },
            { text: 'Lokasi', href: 'alamat.html' },
            { text: 'Review', href: 'review.html' },
            { text: 'Kontak', href: 'kontak.html' }
        ];

        pages.forEach((page, index) => {
            const link = document.createElement('a');
            link.href = page.href;
            link.textContent = page.text;
            link.className = 'nav-hamburger-link';
            const isHomePage = page.text === 'Home' && (
                window.location.pathname.endsWith('index.html') ||
                window.location.pathname.endsWith('/')
            );
            if (isHomePage || window.location.pathname.endsWith(page.href)) {
                link.classList.add('active');
            }
            if (page.text === 'Menu' && window.location.pathname.endsWith('menu.html')) {
                link.classList.add('active');
            }
            if (page.text === 'Gallery') {
                link.setAttribute('data-gallery-link', 'true');
            }
            link.style.animationDelay = `${index * 0.06}s`;
            mobileNavPanel.appendChild(link);
        });

        const themeButton = document.createElement('button');
        themeButton.type = 'button';
        themeButton.className = 'nav-hamburger-theme theme-toggle';
        themeButton.setAttribute('aria-label', 'Ganti tema');
        themeButton.innerHTML = '<i class="fa-solid fa-moon"></i><span>Ganti tema</span>';
        themeButton.addEventListener('click', () => {
            toggleTheme();
            closeHamburgerMenu();
        });
        mobileNavPanel.appendChild(themeButton);

        navContainer.appendChild(mobileNavPanel);
    }

    const closeHamburgerMenu = () => {
        hamburgerButton.classList.remove('is-open');
        mobileNavPanel.classList.remove('is-open');
        hamburgerButton.setAttribute('aria-expanded', 'false');
        hamburgerButton.setAttribute('aria-label', 'Buka menu utama');
        hamburgerButton.setAttribute('title', 'Buka menu utama');
        mobileNavPanel.setAttribute('aria-hidden', 'true');
    };

    const toggleHamburgerMenu = () => {
        const isOpen = !hamburgerButton.classList.contains('is-open');
        hamburgerButton.classList.toggle('is-open', isOpen);
        mobileNavPanel.classList.toggle('is-open', isOpen);
        hamburgerButton.setAttribute('aria-expanded', String(isOpen));
        hamburgerButton.setAttribute('aria-label', isOpen ? 'Tutup menu utama' : 'Buka menu utama');
        hamburgerButton.setAttribute('title', isOpen ? 'Tutup menu utama' : 'Buka menu utama');
        mobileNavPanel.setAttribute('aria-hidden', String(!isOpen));
    };

    hamburgerButton.onclick = (event) => {
        event.stopPropagation();
        toggleHamburgerMenu();
    };

    const closeButton = mobileNavPanel.querySelector('.nav-hamburger-close');
    if (closeButton) closeButton.onclick = closeHamburgerMenu;

    mobileNavPanel.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            closeHamburgerMenu();
        });
    });

    document.addEventListener('click', (event) => {
        if (!navContainer.contains(event.target)) {
            closeHamburgerMenu();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeHamburgerMenu();
            closeAdminConfirm();
        }
    });
}

async function loadAdminFeedback() {
    const containers = [
        document.getElementById('adminDashboardFeedbackList'),
        document.getElementById('adminFeedbackList')
    ].filter(Boolean);

    if (!containers.length || !supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('feedback_messages')
        .select('id, name, contact, message, status, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Kritik & saran database gagal dimuat:', error);
        containers.forEach((list) => {
            list.innerHTML = '<p class="review-empty">Data kritik & saran belum bisa dimuat. Pastikan table feedback_messages sudah dibuat di database.sql.</p>';
        });
        return;
    }

    adminDatabaseFeedback = data || [];
    renderAdminFeedback();
}

async function loadAdminComments() {
    const list = document.getElementById('adminReviewList');
    if (!list || !supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('comments')
        .select('id, name, food, rating, message, status, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Komentar database gagal dimuat:', error);
        list.innerHTML = '<p class="review-empty">Komentar Supabase belum bisa dimuat. Jalankan policy terbaru dari database.sql.</p>';
        showAdminToast('Gagal', 'Komentar Supabase belum bisa dimuat. Periksa policy database.');
        return;
    }

    adminDatabaseComments = data || [];
    renderAdminReviews();
}

async function approveAdminComment(commentId, button) {
    if (!supabaseClient || !commentId) return;
    button.disabled = true;
    button.textContent = 'Menyetujui...';

    const { error } = await supabaseClient
        .from('comments')
        .update({ status: 'approved' })
        .eq('id', commentId)
        .eq('status', 'pending');

    if (error) {
        console.error('Approve komentar gagal:', error);
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-check"></i> Approve';
        showAdminToast('Gagal', 'Komentar belum berhasil di-approve.');
        return;
    }

    await loadAdminComments();
    await loadCommentsFromDatabase();
    showAdminToast('Berhasil', 'Komentar telah di-approve dan tampil di halaman review.');
}

async function declineAdminComment(commentId, button) {
    if (!supabaseClient || !commentId) return;
    openAdminConfirm('Tolak Komentar?', 'Komentar ini akan ditandai sebagai rejected dan tidak akan tampil di halaman review.', async () => {
        button.disabled = true;
        button.textContent = 'Menolak...';

        const { error } = await supabaseClient
            .from('comments')
            .update({ status: 'rejected' })
            .eq('id', commentId)
            .eq('status', 'pending');

        if (error) {
            console.error('Decline komentar gagal:', error);
            button.disabled = false;
            button.innerHTML = '<i class="fa-solid fa-xmark"></i> Decline';
            showAdminToast('Gagal', 'Komentar belum berhasil ditolak.');
            return;
        }

        await loadAdminComments();
        showAdminToast('Berhasil', 'Komentar telah ditolak.');
    });
}

function deleteAdminComment(commentId) {
    if (!supabaseClient || !commentId) return;
    openAdminConfirm('Hapus Komentar?', 'Komentar ini akan dihapus permanen dari Supabase.', async () => {
        const { error } = await supabaseClient.from('comments').delete().eq('id', commentId);
        if (error) {
            console.error('Hapus komentar gagal:', error);
            showAdminToast('Gagal', 'Komentar belum berhasil dihapus. Jalankan policy terbaru.');
            return;
        }
        await loadAdminComments();
        await loadCommentsFromDatabase();
        showAdminToast('Berhasil', 'Komentar telah dihapus.');
    });
}

async function updateAdminOrderStatus(orderId, nextStatus) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.from('sales_orders').update({ status: nextStatus }).eq('id', orderId);
    if (error) {
        console.error('Status pesanan gagal diperbarui:', error);
        showAdminToast('Database', `Status gagal diperbarui: ${error.message}`);
        return;
    }
    showAdminToast('Status diperbarui', formatOrderStatus(nextStatus));
    await loadAdminDatabaseData();
}

function toggleHeaderTools() {
    const menu = document.getElementById('navToolsMenu');
    const panel = document.getElementById('navToolsPanel');
    const toggle = menu?.querySelector('.nav-tools-toggle');
    if (!menu || !panel || !toggle) return;
    const isOpen = menu.classList.toggle('is-open');
    panel.setAttribute('aria-hidden', String(!isOpen));
    toggle.setAttribute('aria-expanded', String(isOpen));
}

function closeHeaderTools() {
    const menu = document.getElementById('navToolsMenu');
    const panel = document.getElementById('navToolsPanel');
    const toggle = menu?.querySelector('.nav-tools-toggle');
    if (!menu || !panel || !toggle) return;
    menu.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
}