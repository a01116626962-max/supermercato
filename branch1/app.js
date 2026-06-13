// ==========================================
// 1. استدعاء مكتبات Firebase
// ==========================================
// ⚠️ تم إضافة الدوال الجديدة: query, where, limit, writeBatch
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, query, where, limit, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ⚠️ إعدادات Firebase الخاصة بك
const firebaseConfig = {
  apiKey: "AIzaSyDL5RFFP6WwxA5yGvhl0EF5mG0UKZi5GcA",
  authDomain: "a01116626962-82e29.firebaseapp.com",
  projectId: "a01116626962-82e29",
  storageBucket: "a01116626962-82e29.firebasestorage.app",
  messagingSenderId: "245357920580",
  appId: "1:245357920580:web:ef3fdd3d441db66ce31711",
  measurementId: "G-03K80R8RYM"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// ==========================================
// 2. المتغيرات العامة وإعدادات الأمان
// ==========================================
const ADMIN_PASSWORD = "1234";
let cart = [];
// تم الإبقاء على المتغير ده للإدارة فقط (المخزن)
let productsList = [];

// ==========================================
// 3. التنقل بين الواجهات ونظام الحماية
// ==========================================
const navPosBtn = document.getElementById('navPosBtn');
const navAdminBtn = document.getElementById('navAdminBtn');
const posSection = document.getElementById('posSection');
const adminSection = document.getElementById('adminSection');
const authModal = document.getElementById('authModal');

// فتح شاشة البيع
navPosBtn.addEventListener('click', () => {
    posSection.style.display = 'block';
    adminSection.style.display = 'none';
    navPosBtn.classList.add('active');
    navAdminBtn.classList.remove('active');
    document.getElementById('barcodeInput').focus();
});

// محاولة فتح شاشة الإدارة
navAdminBtn.addEventListener('click', () => {
    authModal.style.display = 'flex';
    document.getElementById('adminPasswordInput').focus();
});

// إغلاق نافذة الباسورد
document.getElementById('closeAuthBtn').addEventListener('click', () => {
    authModal.style.display = 'none';
    document.getElementById('adminPasswordInput').value = '';
});

// التحقق من الباسورد
document.getElementById('verifyAdminBtn').addEventListener('click', verifyPassword);
document.getElementById('adminPasswordInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyPassword();
});

function verifyPassword() {
    const input = document.getElementById('adminPasswordInput').value;
    if (input === ADMIN_PASSWORD) {
        authModal.style.display = 'none';
        posSection.style.display = 'none';
        adminSection.style.display = 'block';
        navAdminBtn.classList.add('active');
        navPosBtn.classList.remove('active');
        document.getElementById('adminPasswordInput').value = '';
        loadInventory();
    } else {
        alert("كلمة المرور غير صحيحة!");
    }
}

// تبويبات الإدارة الداخلية
document.getElementById('tabInventoryBtn').addEventListener('click', () => switchAdminTab('inventoryTab', 'tabInventoryBtn'));
document.getElementById('tabExpensesBtn').addEventListener('click', () => switchAdminTab('expensesTab', 'tabExpensesBtn'));
document.getElementById('tabStatsBtn').addEventListener('click', () => {
    switchAdminTab('statsTab', 'tabStatsBtn');
    loadStats();
});

function switchAdminTab(tabId, btnId) {
    document.getElementById('inventoryTab').style.display = 'none';
    document.getElementById('expensesTab').style.display = 'none';
    document.getElementById('statsTab').style.display = 'none';
    
    document.getElementById('tabInventoryBtn').classList.remove('active-tab');
    document.getElementById('tabExpensesBtn').classList.remove('active-tab');
    document.getElementById('tabStatsBtn').classList.remove('active-tab');

    document.getElementById(tabId).style.display = 'block';
    document.getElementById(btnId).classList.add('active-tab');
}

// ==========================================
// 4. إدارة المخزن (إضافة وعرض المنتجات)
// ==========================================

// إضافة منتج جديد
document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = "جاري الإضافة...";
    btn.disabled = true;

    const newProduct = {
        barcode: document.getElementById('prodBarcode').value,
        name: document.getElementById('prodName').value,
        buyPrice: parseFloat(document.getElementById('prodBuyPrice').value),
        sellPrice: parseFloat(document.getElementById('prodSellPrice').value),
        quantity: parseInt(document.getElementById('prodQty').value),
        minAlert: parseInt(document.getElementById('prodMinAlert').value)
    };

    try {
        await addDoc(collection(db, "products"), newProduct);
        alert("تمت إضافة المنتج بنجاح!");
        document.getElementById('addProductForm').reset();
        loadInventory();
    } catch (error) {
        console.error("Error adding document: ", error);
        alert("حدث خطأ أثناء الإضافة.");
    } finally {
        btn.innerText = "إضافة / تحديث المنتج";
        btn.disabled = false;
    }
});

// جلب المنتجات وعرضها في المخزن
async function loadInventory() {
    const tbody = document.getElementById('inventoryBody');
    tbody.innerHTML = '<tr><td colspan="6">جاري التحميل...</td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        productsList = [];
        tbody.innerHTML = '';

        querySnapshot.forEach((doc) => {
            let prod = doc.data();
            prod.id = doc.id;
            productsList.push(prod);

            let isLowStock = prod.quantity <= prod.minAlert ? 'low-stock' : '';

            tbody.innerHTML += `
                <tr class="${isLowStock}">
                    <td>${prod.barcode}</td>
                    <td>${prod.name}</td>
                    <td>${prod.quantity}</td>
                    <td>${prod.buyPrice}</td>
                    <td>${prod.sellPrice}</td>
                    <td><button onclick="alert('ميزة التعديل ستتم إضافتها لاحقاً')">تعديل</button></td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error loading inventory: ", error);
        tbody.innerHTML = '<tr><td colspan="6">حدث خطأ في تحميل البيانات</td></tr>';
    }
}

// ==========================================
// 5. شاشة البيع (الكاشير والبحث المباشر)
// ==========================================

const barcodeInput = document.getElementById('barcodeInput');
barcodeInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const code = barcodeInput.value.trim();
        if(code === "") return;

        // ⚠️ التعديل الجديد: بحث مباشر في السيرفر بدل تحميل كل المنتجات
        try {
            // البحث برقم الباركود أولاً (قراءة واحدة فقط)
            const q = query(collection(db, "products"), where("barcode", "==", code), limit(1));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const productDoc = querySnapshot.docs[0];
                let product = productDoc.data();
                product.id = productDoc.id;
                addToCart(product);
                barcodeInput.value = '';
            } else {
                // لو مش باركود، نجرب نبحث بالاسم
                const qName = query(collection(db, "products"), where("name", ">=", code), where("name", "<=", code + '\uf8ff'), limit(1));
                const nameSnapshot = await getDocs(qName);
                
                if (!nameSnapshot.empty) {
                    const productDoc = nameSnapshot.docs[0];
                    let product = productDoc.data();
                    product.id = productDoc.id;
                    addToCart(product);
                    barcodeInput.value = '';
                } else {
                    window.playSound('error');
                    alert("المنتج غير موجود!");
                }
            }
        } catch (error) {
            console.error("Error searching product:", error);
            window.playSound('error');
            alert("حدث خطأ في البحث!");
        }
    }
});

// إضافة المنتج للسلة
function addToCart(product) {
    let existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        if(existingItem.cartQty < product.quantity) {
            existingItem.cartQty += 1;
            window.playSound('success'); // 🔊 إضافة صوت النجاح
        } else {
            window.playSound('error'); // 🔊 إضافة صوت الخطأ
            alert("الكمية المتاحة في المخزن لا تكفي!");
            return;
        }
    } else {
        if(product.quantity > 0) {
            cart.push({ ...product, cartQty: 1 });
            window.playSound('success'); // 🔊 إضافة صوت النجاح
        } else {
            window.playSound('error'); // 🔊 إضافة صوت الخطأ
            alert("المنتج نفذ من المخزن!");
            return;
        }
    }
    renderCart();
}

// رسم جدول السلة وحساب الإجمالي
function renderCart() {
    const tbody = document.getElementById('cartBody');
    tbody.innerHTML = '';
    let total = 0;

    if (cart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">السلة فارغة</td></tr>';
    }

    cart.forEach((item, index) => {
        let itemTotal = item.sellPrice * item.cartQty;
        total += itemTotal;

        tbody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td>${item.sellPrice}</td>
                <td>
                    <button onclick="window.changeQty(${index}, -1)">-</button>
                    <span style="margin: 0 10px;">${item.cartQty}</span>
                    <button onclick="window.changeQty(${index}, 1)">+</button>
                </td>
                <td>${itemTotal}</td>
                <td><button onclick="window.removeFromCart(${index})" style="background-color: var(--danger-color);">حذف</button></td>
            </tr>
        `;
    });

    document.getElementById('cartTotal').innerText = total;
}

// تغيير الكمية من السلة (دوال عامة للنافذة)
window.changeQty = function(index, amount) {
    const newQty = cart[index].cartQty + amount;
    if (newQty > 0 && newQty <= cart[index].quantity) {
        cart[index].cartQty = newQty;
        renderCart();
    } else if (newQty <= 0) {
        window.removeFromCart(index);
    } else {
        window.playSound('error'); // 🔊 إضافة صوت الخطأ
        alert("الكمية المتاحة في المخزن لا تكفي!");
    }
};

// حذف من السلة
window.removeFromCart = function(index) {
    cart.splice(index, 1);
    renderCart();
};

// ==========================================
// 6. تأكيد البيع وإنشاء الفاتورة (Batch Transactions)
// ==========================================
document.getElementById('checkoutBtn').addEventListener('click', async () => {
    if (cart.length === 0) {
        alert("السلة فارغة!");
        return;
    }

    const btn = document.getElementById('checkoutBtn');
    btn.innerText = "جاري حفظ الفاتورة...";
    btn.disabled = true;

    let totalSales = 0;
    let totalCost = 0;
    
    const invoiceItems = cart.map(item => {
        totalSales += (item.sellPrice * item.cartQty);
        totalCost += (item.buyPrice * item.cartQty);
        return {
            productId: item.id,
            name: item.name,
            qty: item.cartQty,
            price: item.sellPrice
        };
    });

    const newInvoice = {
        timestamp: new Date().toISOString(),
        items: invoiceItems,
        totalSales: totalSales,
        totalCost: totalCost
    };

    try {
        // ⚠️ التعديل الجديد: استخدام الـ Batch عشان نضمن إن الفاتورة وخصم الكمية يحصلوا مع بعض
        const batch = writeBatch(db);

        // 1. تجهيز إنشاء الفاتورة
        const invoiceRef = doc(collection(db, "invoices")); 
        batch.set(invoiceRef, newInvoice);

        // 2. تجهيز خصم الكميات من المخزن
        for (const item of cart) {
            const productRef = doc(db, "products", item.id);
            const newQty = item.quantity - item.cartQty;
            batch.update(productRef, { quantity: newQty });
        }

        // 3. إرسال كل الطلبات مرة واحدة للسيرفر
        await batch.commit();

        window.playSound('success'); 
        alert("تم البيع وحفظ الفاتورة بنجاح!");
        cart = [];
        renderCart();
        document.getElementById('barcodeInput').focus();

    } catch (error) {
        console.error("Checkout Error: ", error);
        window.playSound('error'); 
        alert("حدث خطأ! لم يتم حفظ الفاتورة أو خصم الكميات لضمان صحة البيانات.");
    } finally {
        btn.innerText = "تأكيد البيع وحفظ الفاتورة";
        btn.disabled = false;
    }
});

// ==========================================
// 7. المصروفات والإحصائيات
// ==========================================

// تسجيل مصروف
document.getElementById('addExpenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = "جاري التسجيل...";
    btn.disabled = true;

    const newExpense = {
        title: document.getElementById('expTitle').value,
        amount: parseFloat(document.getElementById('expAmount').value),
        date: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "expenses"), newExpense);
        alert("تم تسجيل المصروف!");
        document.getElementById('addExpenseForm').reset();
    } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء تسجيل المصروف.");
    } finally {
        btn.innerText = "تسجيل المصروف";
        btn.disabled = false;
    }
});

// حساب الإحصائيات
async function loadStats() {
    try {
        let totalSales = 0;
        let totalCost = 0;
        let totalExpenses = 0;

        // جلب الفواتير
        const invoicesSnap = await getDocs(collection(db, "invoices"));
        invoicesSnap.forEach(doc => {
            const data = doc.data();
            totalSales += data.totalSales || 0;
            totalCost += data.totalCost || 0;
        });

        // جلب المصروفات
        const expensesSnap = await getDocs(collection(db, "expenses"));
        expensesSnap.forEach(doc => {
            totalExpenses += doc.data().amount || 0;
        });

        // الحساب النهائي
        let grossProfit = totalSales - totalCost;
        let netProfit = grossProfit - totalExpenses;

        document.getElementById('totalSalesStat').innerText = totalSales + " جنيه";
        document.getElementById('totalExpensesStat').innerText = totalExpenses + " جنيه";
        
        const netProfitEl = document.getElementById('netProfitStat');
        netProfitEl.innerText = netProfit + " جنيه";
        netProfitEl.style.color = netProfit >= 0 ? "var(--success-color)" : "var(--danger-color)";

    } catch (error) {
        console.error("Error loading stats: ", error);
    }
}

// تحميل المخزن عند بداية التشغيل (تم إيقافها هنا لإن الإدارة مقفولة، هتتحمل لما المدير يدخل)
// loadInventory(); 

// ==========================================
// 8. تشغيل القائمة الجانبية (Sidebar)
// ==========================================
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const menuBtn = document.getElementById('menuBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

function openSidebar() {
    sidebar.classList.add('active');
    sidebarOverlay.classList.add('active');
}

function closeSidebar() {
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
}

menuBtn.addEventListener('click', openSidebar);
closeSidebarBtn.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// إغلاق القائمة تلقائياً عند اختيار صفحة
navPosBtn.addEventListener('click', closeSidebar);
navAdminBtn.addEventListener('click', closeSidebar);

// ==========================================
// 9. تشغيل المؤثرات الصوتية (Sound Effects)
// ==========================================
const successSound = document.getElementById('successSound');
const errorSound = document.getElementById('errorSound');

window.playSound = function(type) {
    try {
        if (type === 'success') {
            successSound.currentTime = 0;
            successSound.play();
        } else if (type === 'error') {
            errorSound.currentTime = 0;
            errorSound.play();
        }
    } catch (error) {
        console.log("الصوت لم يعمل، قد يحتاج لتفاعل المستخدم أولاً");
    }
};

// ==========================================
// 10. تشغيل الكاميرا كقارئ باركود
// ==========================================
const startCameraBtn = document.getElementById('startCameraBtn');
const readerDiv = document.getElementById('reader');
let html5QrCode;
let isCameraOpen = false;

startCameraBtn.addEventListener('click', () => {
    if (isCameraOpen) {
        // إغلاق الكاميرا
        html5QrCode.stop().then(() => {
            readerDiv.style.display = 'none';
            isCameraOpen = false;
            startCameraBtn.innerHTML = '📷'; 
        }).catch(err => console.log("خطأ في إغلاق الكاميرا", err));
    } else {
        // فتح الكاميرا
        readerDiv.style.display = 'block';
        html5QrCode = new window.Html5Qrcode("reader");
        
        html5QrCode.start(
            { facingMode: "environment" }, // الكاميرا الخلفية
            {
                fps: 10, 
                qrbox: { width: 250, height: 100 } // مقاس مستطيل الباركود
            },
            (decodedText) => {
                // عند قراءة الباركود بنجاح
                const barcodeInput = document.getElementById('barcodeInput');
                barcodeInput.value = decodedText;
                
                // إغلاق الكاميرا أوتوماتيك بعد القراءة
                html5QrCode.stop().then(() => {
                    readerDiv.style.display = 'none';
                    isCameraOpen = false;
                    startCameraBtn.innerHTML = '📷';
                    
                    // محاكاة الضغط على "Enter" عشان ينفذ دالة البحث الجديدة
                    const enterEvent = new KeyboardEvent('keypress', { key: 'Enter' });
                    barcodeInput.dispatchEvent(enterEvent);
                });
            },
            (errorMessage) => {
                // تجاهل أخطاء القراءة أثناء تحريك الموبايل
            }
        ).then(() => {
            isCameraOpen = true;
            startCameraBtn.innerHTML = '❌ إغلاق الكاميرا';
        }).catch((err) => {
            console.log("خطأ في تشغيل الكاميرا", err);
            alert("برجاء السماح للمتصفح باستخدام الكاميرا!");
            readerDiv.style.display = 'none';
        });
    }
});
