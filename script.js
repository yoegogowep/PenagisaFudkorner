// Ganti nomor WhatsApp UMKM di sini (gunakan format 62)
const NOMOR_WA_UMKM = "6282135783347";
const THEME_KEY = "umkm_theme";
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
let adminConfirmAction = null;

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
    const { error } = await supabaseClient.from('comments').insert({ ...comment, status: 'pending' });
    if (error) console.error('Komentar gagal disimpan ke database:', error);
}

async function loadCommentsFromDatabase() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
        .from('comments')
        .select('name, food, rating, message')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
    if (!error && data?.length) {
        localStorage.setItem('umkm_reviews', JSON.stringify(data));
        renderReviews();
    }
}

async function saveOrderToDatabase(order, items) {
    if (!supabaseClient) return true;
    const { data, error } = await supabaseClient.from('sales_orders').insert(order).select('id').single();
    if (error || !data) {
        console.error('Pesanan gagal disimpan ke database:', error);
        return false;
    }
    const { error: itemError } = await supabaseClient.from('sales_order_items').insert(
        items.map(item => ({ ...item, order_id: data.id }))
    );
    if (itemError) console.error('Detail pesanan gagal disimpan:', itemError);
    return !itemError;
}

function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';

    const button = document.querySelector('.theme-toggle');
    if (button) {
        button.innerHTML = `<i class="fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}"></i>`;
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
            "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=900&q=80"
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
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80"
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
            "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80"
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
            "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80"
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
            "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80"
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
            "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80"
        ]
    }
];

// Ambil Keranjang dari localStorage agar tidak hilang saat pindah halaman
let cart = JSON.parse(localStorage.getItem('umkm_cart')) || {};
let cartDimTimer;
let pendingOrder = null;
let qrisPaymentConfirmed = false;

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
                <div class="card-rating" aria-label="Rating ${item.rating} dari 5 bintang">
                    <span class="card-rating-stars">★★★★★</span>
                    <strong>${item.rating.toFixed(1)}</strong>
                </div>
                <div class="card-footer">
                    ${item.comingSoon ? `
                        <span class="coming-soon-label"><i class="fa-solid fa-clock"></i> Segera Hadir</span>
                    ` : `
                        <span class="card-price">Rp ${item.price.toLocaleString('id-ID')}</span>
                        <div class="menu-actions">
                            <a href="review.html" class="review-btn">Review</a>
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
    const existing = document.querySelector('.cart-add-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'cart-add-notification';
    notification.innerHTML = `
        <i class="fa-solid fa-circle-check"></i>
        <span>${itemName} masuk ke keranjang (${quantity}x)</span>
    `;
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

function sendFeedbackToWhatsApp(event) {
    event.preventDefault();

    const name = document.getElementById('feedbackName').value.trim();
    const contact = document.getElementById('feedbackContact').value.trim();
    const message = document.getElementById('feedbackMessage').value.trim();

    if (!name || !contact || !message) {
        showInlineAlert('Nama, kontak, dan pesan wajib diisi.');
        return;
    }

    const text = `*KRITIK & SARAN - Penagisa Food Corner*\n\n*Nama:* ${name}\n*Kontak:* ${contact}\n*Pesan:*\n${message}`;
    window.open(`https://wa.me/${NOMOR_WA_UMKM}?text=${encodeURIComponent(text)}`, '_blank');
    document.getElementById('feedbackForm').reset();
}

function getReviewAverage(reviews) {
    if (!reviews.length) return 1;

    const totalRating = reviews.reduce((sum, review) => sum + Number(review.rating), 0);
    return Math.min(5, Math.max(1, totalRating / reviews.length));
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

    const storedReviews = JSON.parse(localStorage.getItem('umkm_reviews')) || [];
    const reviews = storedReviews.length > 0 ? storedReviews : DEFAULT_REVIEWS;
    renderReviewSummary(reviews);
    reviewList.innerHTML = '';

    if (reviews.length === 0) {
        reviewList.innerHTML = '<p class="review-empty">Belum ada review. Jadilah yang pertama!</p>';
        return;
    }

    reviews.forEach((review, index) => {
        const item = document.createElement('article');
        item.className = `review-item${highlightLatest && index === 0 ? ' is-new' : ''}`;
        item.innerHTML = `
            <div class="review-item-header">
                <div>
                    <div class="review-item-name"></div>
                    <div class="review-item-food"></div>
                </div>
                <div class="review-item-stars" aria-label="${review.rating} dari 5 bintang">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
            </div>
            <p class="review-item-message"></p>
        `;
        item.querySelector('.review-item-name').textContent = review.name;
        item.querySelector('.review-item-food').textContent = review.food;
        item.querySelector('.review-item-message').textContent = review.message;
        reviewList.appendChild(item);
    });
}

function setupReviewForm() {
    const form = document.getElementById('reviewForm');
    if (!form) return;

    const stars = form.querySelectorAll('.star-btn');
    const ratingInput = document.getElementById('reviewRating');
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
        const rating = Number(ratingInput.value);
        if (!rating) {
            showInlineAlert('Silakan pilih rating bintang terlebih dahulu.');
            return;
        }

        const comment = {
            name: document.getElementById('reviewName').value.trim(),
            food: document.getElementById('reviewFood').value,
            rating,
            message: document.getElementById('reviewMessage').value.trim()
        };
        const storedReviews = JSON.parse(localStorage.getItem('umkm_reviews')) || [];
        const reviews = storedReviews.length > 0 ? storedReviews : [...DEFAULT_REVIEWS];
        reviews.unshift(comment);
        localStorage.setItem('umkm_reviews', JSON.stringify(reviews));
        await saveCommentToDatabase(comment);
        form.reset();
        ratingInput.value = '0';
        stars.forEach((button) => button.classList.remove('is-selected'));
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

    if (!orderType || !addressGroup) return;

    const isDelivery = orderType.value === "Delivery";
    addressGroup.style.display = isDelivery ? "block" : "none";

    if (addressLabel) {
        addressLabel.textContent = "ALAMAT LENGKAP";
    }

    if (custAddress) {
        custAddress.placeholder = isDelivery ? "Isi alamat rumah Anda" : "";
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
    if (pendingOrder) {
        sendOrderToWhatsApp();
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
    setOrderActionButton('Konfirmasi ke WhatsApp', true);
    handlePaymentMethodChange();
}

function handlePaymentMethodChange() {
    const paymentMethod = document.getElementById('paymentMethod')?.value;
    if (!paymentMethod) return;

    if (paymentMethod === 'QRIS') {
        qrisPaymentConfirmed = false;
        const modal = document.getElementById('qrisPaymentModal');
        if (modal) {
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
        }
        return;
    }

    setOrderActionButton('Konfirmasi ke WhatsApp', true);
}

function closeQrisPaymentModal() {
    const modal = document.getElementById('qrisPaymentModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

function confirmQrisPayment() {
    qrisPaymentConfirmed = true;
    closeQrisPaymentModal();
    showInlineAlert('Pembayaran telah berhasil. Silakan konfirmasi ke WhatsApp.', 4000);
    setOrderActionButton('Konfirmasi ke WhatsApp', true);
}

// KIRIM KE WHATSAPP setelah metode pembayaran dipilih
async function sendOrderToWhatsApp() {
    if (!pendingOrder) {
        startOrderConfirmation();
        return;
    }

    const paymentMethod = document.getElementById('paymentMethod')?.value;
    if (!paymentMethod) {
        showInlineAlert('Silakan pilih metode pembayaran terlebih dahulu.');
        return;
    }

    if (paymentMethod === 'QRIS' && !qrisPaymentConfirmed) {
        const modal = document.getElementById('qrisPaymentModal');
        if (modal) {
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
        }
        showInlineAlert('Selesaikan pembayaran QRIS terlebih dahulu.');
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

    let text = `*PESANAN BARU - Penagisa Food Corner* 🍽️\n\n`;
    text += `*Rincian Pesanan:*\n`;

    let total = 0;
    Object.keys(cart).forEach((id, idx) => {
        const item = menuItems.find(m => m.id == id);
        const qty = cart[id];
        const sub = item.price * qty;
        total += sub;
        text += `${idx + 1}. ${item.name} (${qty}x) = Rp ${sub.toLocaleString('id-ID')}\n`;
    });

    text += `\n*Total:* Rp ${total.toLocaleString('id-ID')}\n`;
    text += `----------------------------------\n`;
    text += `*Nama:* ${name}\n`;
    const typeLabel = type === 'Delivery' ? 'Delivery / Antar ke Rumah' : 'Takeaway / Ambil Sendiri';
    text += `*Opsi Pesanan:* ${typeLabel}\n`;
    if (type === 'Delivery') {
        text += `*Alamat:* ${address}\n`;
    }
    if (note) text += `*Catatan:* ${note}\n`;
    text += `*Metode Pembayaran:* ${paymentMethod === 'QRIS' ? 'QRIS - SUDAH BAYAR' : 'COD - BAYAR DI TEMPAT'}\n`;
    text += paymentMethod === 'QRIS'
        ? `*Bukti pembayaran:* Akan dikirim melalui WhatsApp.\n\nMohon cek bukti transfer. Terima kasih!`
        : `\nMohon konfirmasi pesanan COD ini. Terima kasih!`;

    const saved = await saveOrderToDatabase({
        customer_name: name,
        order_type: type,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'QRIS' ? 'paid' : 'cod_confirmed',
        payment_confirmed_at: new Date().toISOString(),
        address: type === 'Delivery' ? address : null,
        note: note || null,
        total_amount: total,
        whatsapp_sent_at: new Date().toISOString()
    }, orderItems);

    if (!saved) {
        showInlineAlert('Pesanan gagal disimpan ke database. Jalankan database.sql terbaru lalu coba lagi.');
        return;
    }

    window.open(`https://wa.me/${NOMOR_WA_UMKM}?text=${encodeURIComponent(text)}`, '_blank');
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
    renderAdminStats();
    loadAdminComments();
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
        renderAdminStats();
        loadAdminComments();
        loadAdminDatabaseData();
    } else {
        openAdminGate();
    }
}

function adminLogout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.href = 'index.html';
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

    const [dashboardResult, ordersResult] = await Promise.all([
        supabaseClient.from('admin_dashboard').select('*').single(),
        supabaseClient.from('sales_orders').select('created_at, customer_name, order_type, status, total_amount').order('created_at', { ascending: false }).limit(10)
    ]);

    if (dashboardResult.error || ordersResult.error) {
        status.textContent = 'Database terhubung, tetapi belum bisa dibaca. Jalankan database.sql dan periksa policy Supabase.';
        console.error('Data dashboard gagal dimuat:', dashboardResult.error || ordersResult.error);
        return;
    }

    const summary = dashboardResult.data;
    document.getElementById('dbTotalClicks').textContent = summary.total_link_clicks ?? 0;
    document.getElementById('dbTotalOrders').textContent = summary.total_orders ?? 0;
    document.getElementById('dbTotalSales').textContent = `Rp ${Number(summary.total_sales || 0).toLocaleString('id-ID')}`;
    status.textContent = `Terakhir diperbarui ${new Date().toLocaleString('id-ID')}. Menampilkan 10 pesanan terbaru.`;

    ordersList.innerHTML = '';
    if (!ordersResult.data.length) {
        ordersList.innerHTML = '<tr><td colspan="5">Belum ada pesanan di database.</td></tr>';
        return;
    }

    ordersResult.data.forEach(order => {
        const row = document.createElement('tr');
        [
            new Date(order.created_at).toLocaleString('id-ID'),
            order.customer_name,
            order.order_type,
            order.status,
            `Rp ${Number(order.total_amount || 0).toLocaleString('id-ID')}`
        ].forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.appendChild(cell);
        });
        ordersList.appendChild(row);
    });
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
    applyTheme(localStorage.getItem(THEME_KEY) || 'light');
    setupHamburgerNavigation();
    recordAudienceClick();
    loadCommentsFromDatabase();

    const websiteQr = document.getElementById('websiteQr');
    if (websiteQr && typeof QRCode !== 'undefined') {
        new QRCode(websiteQr, {
            text: getWebsiteLink(),
            width: 144,
            height: 144,
            colorDark: '#1e272e',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
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
        gate.classList.remove('is-hidden');
        document.body.classList.add('gate-open');
        startMenuIntro(gate);
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
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        closeReviewThankYou();
        closeCartModal();
        closeProductModal();
        closeAdminGate();
    });
    updateCartUI();
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

function setupGalleryPage() {
    const galleryGrid = document.querySelector('.gallery-grid');
    if (!galleryGrid) return;

    const items = galleryGrid.querySelectorAll('.gallery-item');
    const filters = document.querySelectorAll('[data-gallery-filter]');
    const lightbox = document.getElementById('galleryLightbox');
    const lightboxImage = document.getElementById('galleryLightboxImage');
    const lightboxCaption = document.getElementById('galleryLightboxCaption');

    filters.forEach((filter) => {
        filter.addEventListener('click', () => {
            const category = filter.dataset.galleryFilter;
            filters.forEach((button) => button.classList.toggle('is-active', button === filter));
            items.forEach((item) => {
                item.hidden = category !== 'all' && item.dataset.galleryCategory !== category;
            });
        });
    });

    const closeLightbox = () => {
        if (!lightbox) return;
        lightbox.classList.remove('is-open');
        lightbox.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('review-popup-open');
    };

    items.forEach((item) => {
        const image = item.querySelector('img');
        const viewButton = item.querySelector('.gallery-view-button');
        if (!image || !viewButton || !lightbox || !lightboxImage || !lightboxCaption) return;

        viewButton.addEventListener('click', () => {
            lightboxImage.src = image.currentSrc || image.src;
            lightboxImage.alt = image.alt;
            lightboxCaption.textContent = item.querySelector('h3')?.textContent || image.alt;
            lightbox.classList.add('is-open');
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.classList.add('review-popup-open');
        });
    });

    document.querySelector('.gallery-lightbox-close')?.addEventListener('click', closeLightbox);
    lightbox?.addEventListener('click', (event) => {
        if (event.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeLightbox();
    });
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

        const profileWrap = document.createElement('div');
        profileWrap.className = 'nav-hamburger-profile';
        profileWrap.innerHTML = `
            <div class="nav-hamburger-avatar">P</div>
            <div class="nav-hamburger-profile-meta">
                <span>Profile</span>
                <strong>Penagisa User</strong>
            </div>
        `;
        mobileNavPanel.appendChild(profileWrap);

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