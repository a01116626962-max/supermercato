// ==========================================
// 1. استدعاء مكتبات Firebase
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, query, where, limit, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDL5RFFP6WwxA5yGvhl0EF5mG0UKZi5GcA",
  authDomain: "a01116626962-82e29.firebaseapp.com",
  projectId: "a01116626962-82e29",
  storageBucket: "a01116626962-82e29.firebasestorage.app",
  messagingSenderId: "245357920580",
  appId: "1:245357920580:web:ef3fdd3d441db66ce31711",
  measurementId: "G-03K80R8RYM"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// ==========================================
// 2. المتغيرات العامة وإعدادات الأمان
// ==========================================
const ADMIN_PASSWORD = "1234";
let cart = [];
let productsList = [];

// ⚠️ بيانات الوردية الحالية
let currentShift = {
    active: false,
    cashierName: "",
    startCash: 0,
    sales: 0,
    drops: 0,
    startTime: null
};

// ==========================================
// 3. التنقل ونظام الحماية (المدير والوردية)
// ==========================================
const navPosBtn = document.getElementById('navPosBtn');
const navAdminBtn = document.getElementById('navAdminBtn');
const posSection = document.getElementById('posSection');
const adminSection = document.getElementById('adminSection');
const authModal = document.getElementById('authModal');
const startShiftModal = document.getElementById('startShiftModal');

// فتح شاشة البيع
navPosBtn.addEventListener('click', () => {
    posSection.style.display = 'block';
    adminSection.style.display = 'none';
    navPosBtn.classList.add('active');
    navAdminBtn.classList.remove('active');
    
    // لو مفيش وردية شغالة، رجع شاشة استلام الوردية
    if (!currentShift.active) {
        startShiftModal.style.display = 'flex';
    } else {
        document.getElementById('barcodeInput').focus();
    }
});

// فتح نافذة الباسورد للمدير
navAdminBtn.addEventListener('click', () => {
    authModal.style.display = 'flex';
    document.getElementById('adminPasswordInput').focus();
});

// زر الدخول للإدارة من شاشة الوردية (لو مفيش كاشيرية لسه)
document.getElementById('openAdminFromShiftBtn').addEventListener('click', () => {
    startShiftModal.style.display = 'none';
    authModal.style.display = 'flex';
    document.getElementById('adminPasswordInput').focus();
});

// إغلاق نافذة الإدارة
document.getElementById('closeAuthBtn').addEventListener('click', () => {
    authModal.style.display = 'none';
    document.getElementById('adminPasswordInput').value = '';
    // لو قفل الإدارة ومفيش وردية، رجعه لشاشة الوردية
    if (!currentShift.active && posSection.style.display !== 'none') {
        startShiftModal.style.display = 'flex';
    }
});

// التحقق من باسورد المدير
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

// تبويبات الإدارة
document.getElementById('tabInventoryBtn').addEventListener('click', () => switchAdminTab('inventoryTab', 'tabInventoryBtn'));
document.getElementById('tabExpensesBtn').addEventListener('click', () => switchAdminTab('expensesTab', 'tabExpensesBtn'));
document.getElementById('tabCashiersBtn').addEventListener('click', () => {
    switchAdminTab('cashiersTab', 'tabCashiersBtn');
    loadCashiers();
});
document.getElementById('tabStatsBtn').addEventListener('click', () => {
    switchAdminTab('statsTab', 'tabStatsBtn');
    loadStats();
});

function switchAdminTab(tabId, btnId) {
    document.getElementById('inventoryTab').style.display = 'none';
    document.getElementById('expensesTab').style.display = 'none';
    document.getElementById('cashiersTab').style.display = 'none';
    document.getElementById('statsTab').style.display = 'none';
    
    document.getElementById('tabInventoryBtn').classList.remove('active-tab');
    document.getElementById('tabExpensesBtn').classList.remove('active-tab');
    document.getElementById('tabCashiersBtn').classList.remove('active-tab');
    document.getElementById('tabStatsBtn').classList.remove('active-tab');

    document.getElementById(tabId).style.display = 'block';
    document.getElementById(btnId).classList.add('active-tab');
}

// ==========================================
// 4. إدارة الوردية (بدء - سحب - إنهاء)
// ==========================================

// بدء الوردية (التحقق من الكاشير)
document.getElementById('startShiftBtn').addEventListener('click', async () => {
    const name = document.getElementById('cashierNameInput').value.trim();
    const pass = document.getElementById('cashierPasswordInput').value.trim();
    const startCash = parseFloat(document.getElementById('startCashInput').value);

    if (!name || !pass || isNaN(startCash)) {
        alert("برجاء استكمال جميع البيانات!");
        return;
    }

    const btn = document.getElementById('startShiftBtn');
    btn.innerText = "جاري التحقق...";
    btn.disabled = true;

    try {
        // التحقق من وجود الكاشير في الداتا بيز
        const q = query(collection(db, "cashiers"), where("name", "==", name), where("password", "==", pass));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("اسم الكاشير أو كلمة المرور غير صحيحة!");
            window.playSound('error');
        } else {
            // تسجيل الدخول بنجاح
            currentShift = {
                active: true,
                cashierName: name,
                startCash: startCash,
                sales: 0,
                drops: 0,
                startTime: new Date().toISOString()
            };
            
            startShiftModal.style.display = 'none';
            document.getElementById('shiftInfoDisplay').innerText = `الكاشير: ${name} | العهدة: ${startCash} ج`;
            window.playSound('success');
            document.getElementById('barcodeInput').focus();
        }
    } catch (error) {
        console.error("Shift Start Error:", error);
        alert("حدث خطأ في الاتصال بقاعدة البيانات.");
    } finally {
        btn.innerText = "استلام الوردية";
        btn.disabled = false;
    }
});

// نافذة سحب نقدية للمدير
const cashDropModal = document.getElementById('cashDropModal');
document.getElementById('navCashDropBtn').addEventListener('click', () => {
    if (!currentShift.active) return alert("لا توجد وردية مفتوحة!");
    cashDropModal.style.display = 'flex';
    closeSidebar();
});
document.getElementById('closeDropBtn').addEventListener('click', () => {
    cashDropModal.style.display = 'none';
});

// تأكيد السحب بباسورد المدير
document.getElementById('confirmDropBtn').addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('dropAmountInput').value);
    const pass = document.getElementById('dropAdminPassword').value;

    if (isNaN(amount) || amount <= 0 || !pass) {
        alert("برجاء إدخال المبلغ وكلمة المرور بشكل صحيح.");
        return;
    }

    if (pass === ADMIN_PASSWORD) {
        currentShift.drops += amount;
        alert(`تم تسليم مبلغ ${amount} جنيه للمدير بنجاح.`);
        cashDropModal.style.display = 'none';
        document.getElementById('dropAmountInput').value = '';
        document.getElementById('dropAdminPassword').value = '';
        window.playSound('success');
    } else {
        alert("كلمة مرور المدير غير صحيحة!");
        window.playSound('error');
    }
});

// تقفيل الوردية
const endShiftModal = document.getElementById('endShiftModal');
document.getElementById('navEndShiftBtn').addEventListener('click', () => {
    if (!currentShift.active) return alert("لا توجد وردية مفتوحة!");
    
    document.getElementById('reportStartCash').innerText = currentShift.startCash;
    document.getElementById('reportSales').innerText = currentShift.sales;
    document.getElementById('reportDrops').innerText = currentShift.drops;
    
    const expected = currentShift.startCash + currentShift.sales - currentShift.drops;
    document.getElementById('reportExpectedCash').innerText = expected;

    endShiftModal.style.display = 'flex';
    closeSidebar();
});
document.getElementById('closeEndShiftBtn').addEventListener('click', () => {
    endShiftModal.style.display = 'none';
});

// تأكيد التقفيل وحفظ البيانات
document.getElementById('confirmEndShiftBtn').addEventListener('click', async () => {
    const btn = document.getElementById('confirmEndShiftBtn');
    btn.innerText = "جاري الحفظ...";
    btn.disabled = true;

    try {
        const shiftData = {
            ...currentShift,
            endTime: new Date().toISOString()
        };
        // حفظ بيانات الوردية في السيرفر
        await addDoc(collection(db, "shifts"), shiftData);

        // تصفير الوردية للبدء من جديد
        currentShift = { active: false, cashierName: "", startCash: 0, sales: 0, drops: 0, startTime: null };
        document.getElementById('shiftInfoDisplay').innerText = '';
        endShiftModal.style.display = 'none';
        startShiftModal.style.display = 'flex';
        
        // مسح خانات تسجيل الدخول
        document.getElementById('cashierPasswordInput').value = '';
        document.getElementById('startCashInput').value = '';
        
        window.playSound('success');
        alert("تم تقفيل الوردية بنجاح.");
    } catch (error) {
        console.error("End Shift Error:", error);
        alert("حدث خطأ أثناء حفظ تقرير الوردية!");
    } finally {
        btn.innerText = "إنهاء الوردية وبدء وردية جديدة";
        btn.disabled = false;
    }
});

// ==========================================
// 5. إدارة المخزن والكاشيرية
// ==========================================

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
        alert("حدث خطأ أثناء الإضافة.");
    } finally {
        btn.innerText = "إضافة / تحديث المنتج";
        btn.disabled = false;
    }
});

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
                    <td><button onclick="alert('سيتم إضافة التعديل لاحقاً')">تعديل</button></td>
                </tr>`;
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6">خطأ في تحميل البيانات</td></tr>';
    }
}

// ⚠️ إضافة وعرض الكاشيرية
document.getElementById('addCashierForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newCashierName').value.trim();
    const pass = document.getElementById('newCashierPass').value.trim();

    try {
        await addDoc(collection(db, "cashiers"), { name: name, password: pass });
        alert("تم إضافة الكاشير بنجاح!");
        document.getElementById('addCashierForm').reset();
        loadCashiers();
    } catch (error) {
        alert("حدث خطأ أثناء إضافة الكاشير.");
    }
});

async function loadCashiers() {
    const tbody = document.getElementById('cashiersBody');
    tbody.innerHTML = '<tr><td colspan="3">جاري التحميل...</td></tr>';
    try {
        const snap = await getDocs(collection(db, "cashiers"));
        tbody.innerHTML = '';
        snap.forEach(doc => {
            const data = doc.data();
            tbody.innerHTML += `
                <tr>
                    <td>${data.name}</td>
                    <td>${data.password}</td>
                    <td><button style="background:var(--danger-color)" onclick="alert('سيتم تفعيل الحذف لاحقاً')">حذف</button></td>
                </tr>`;
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="3">خطأ في تحميل البيانات</td></tr>';
    }
}

// ==========================================
// 6. شاشة البيع وتأكيد الفاتورة
// ==========================================

const barcodeInput = document.getElementById('barcodeInput');
barcodeInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const code = barcodeInput.value.trim();
        if(code === "") return;

        try {
            const q = query(collection(db, "products"), where("barcode", "==", code), limit(1));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const productDoc = querySnapshot.docs[0];
                let product = productDoc.data();
                product.id = productDoc.id;
                addToCart(product);
                barcodeInput.value = '';
            } else {
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
            window.playSound('error');
            alert("حدث خطأ في البحث!");
        }
    }
});

function addToCart(product) {
    let existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        if(existingItem.cartQty < product.quantity) {
            existingItem.cartQty += 1;
            window.playSound('success'); 
        } else {
            window.playSound('error'); 
            alert("الكمية المتاحة في المخزن لا تكفي!");
            return;
        }
    } else {
        if(product.quantity > 0) {
            cart.push({ ...product, cartQty: 1 });
            window.playSound('success'); 
        } else {
            window.playSound('error'); 
            alert("المنتج نفذ من المخزن!");
            return;
        }
    }
    renderCart();
}

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
            </tr>`;
    });
    document.getElementById('cartTotal').innerText = total;
}

window.changeQty = function(index, amount) {
    const newQty = cart[index].cartQty + amount;
    if (newQty > 0 && newQty <= cart[index].quantity) {
        cart[index].cartQty = newQty;
        renderCart();
    } else if (newQty <= 0) {
        window.removeFromCart(index);
    } else {
        window.playSound('error');
        alert("الكمية المتاحة في المخزن لا تكفي!");
    }
};

window.removeFromCart = function(index) {
    cart.splice(index, 1);
    renderCart();
};

document.getElementById('checkoutBtn').addEventListener('click', async () => {
    if (!currentShift.active) {
        alert("لا توجد وردية مفتوحة! برجاء استلام الوردية أولاً.");
        return;
    }
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
        cashier: currentShift.cashierName, // ⚠️ ربط الفاتورة باسم الكاشير
        items: invoiceItems,
        totalSales: totalSales,
        totalCost: totalCost
    };

    try {
        const batch = writeBatch(db);
        const invoiceRef = doc(collection(db, "invoices")); 
        batch.set(invoiceRef, newInvoice);

        for (const item of cart) {
            const productRef = doc(db, "products", item.id);
            const newQty = item.quantity - item.cartQty;
            batch.update(productRef, { quantity: newQty });
        }

        await batch.commit();

        // ⚠️ إضافة مبلغ الفاتورة لمبيعات الوردية الحالية
        currentShift.sales += totalSales;

        window.playSound('success'); 
        alert("تم البيع وحفظ الفاتورة بنجاح!");
        cart = [];
        renderCart();
        document.getElementById('barcodeInput').focus();

    } catch (error) {
        window.playSound('error'); 
        alert("حدث خطأ! لم يتم حفظ الفاتورة.");
    } finally {
        btn.innerText = "تأكيد البيع وحفظ الفاتورة";
        btn.disabled = false;
    }
});

// ==========================================
// 7. المصروفات والإحصائيات
// ==========================================
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
        alert("حدث خطأ أثناء تسجيل المصروف.");
    } finally {
        btn.innerText = "تسجيل المصروف";
        btn.disabled = false;
    }
});

async function loadStats() {
    try {
        let totalSales = 0; let totalCost = 0; let totalExpenses = 0;

        const invoicesSnap = await getDocs(collection(db, "invoices"));
        invoicesSnap.forEach(doc => {
            const data = doc.data();
            totalSales += data.totalSales || 0;
            totalCost += data.totalCost || 0;
        });

        const expensesSnap = await getDocs(collection(db, "expenses"));
        expensesSnap.forEach(doc => {
            totalExpenses += doc.data().amount || 0;
        });

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

// ==========================================
// 8. القائمة الجانبية والكاميرا والصوتيات
// ==========================================
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const menuBtn = document.getElementById('menuBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

function openSidebar() { sidebar.classList.add('active'); sidebarOverlay.classList.add('active'); }
function closeSidebar() { sidebar.classList.remove('active'); sidebarOverlay.classList.remove('active'); }

menuBtn.addEventListener('click', openSidebar);
closeSidebarBtn.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);
navPosBtn.addEventListener('click', closeSidebar);
navAdminBtn.addEventListener('click', closeSidebar);

const successSound = document.getElementById('successSound');
const errorSound = document.getElementById('errorSound');

window.playSound = function(type) {
    try {
        if (type === 'success') { successSound.currentTime = 0; successSound.play(); }
        else if (type === 'error') { errorSound.currentTime = 0; errorSound.play(); }
    } catch (error) {}
};

const startCameraBtn = document.getElementById('startCameraBtn');
const readerDiv = document.getElementById('reader');
let html5QrCode;
let isCameraOpen = false;

startCameraBtn.addEventListener('click', () => {
    if (isCameraOpen) {
        html5QrCode.stop().then(() => {
            readerDiv.style.display = 'none';
            isCameraOpen = false;
            startCameraBtn.innerHTML = '📷'; 
        }).catch(err => console.log("خطأ في إغلاق الكاميرا"));
    } else {
        readerDiv.style.display = 'block';
        html5QrCode = new window.Html5Qrcode("reader");
        
        html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 100 } },
            (decodedText) => {
                const barcodeInput = document.getElementById('barcodeInput');
                barcodeInput.value = decodedText;
                html5QrCode.stop().then(() => {
                    readerDiv.style.display = 'none';
                    isCameraOpen = false;
                    startCameraBtn.innerHTML = '📷';
                    barcodeInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter' }));
                });
            },
            () => {} // تجاهل الأخطاء الصامتة
        ).then(() => {
            isCameraOpen = true;
            startCameraBtn.innerHTML = '❌ إغلاق الكاميرا';
        }).catch(() => {
            alert("برجاء السماح للمتصفح باستخدام الكاميرا!");
            readerDiv.style.display = 'none';
        });
    }
});
