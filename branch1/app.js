// ==========================================
// 1. استدعاء مكتبات Firebase
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
// تم إضافة getDoc, increment, setDoc للإحصائيات السريعة
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, setDoc, increment, query, where, limit, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// دالة لتوحيد الحروف العربية للبحث المرن (ميزة جديدة)
function normalizeArabic(text) {
    return text.replace(/[أإآ]/g, 'ا')
               .replace(/ة/g, 'ه')
               .replace(/ى/g, 'ي')
               .trim();
}

// المتغير اللي شايل بيانات الوردية (تم إضافة cashierExpenses)
let currentShift = {
    id: null,
    active: false,
    cashierName: "",
    startCash: 0,
    sales: 0,
    drops: 0,
    cashierExpenses: 0,
    startTime: null
};

// ==========================================
// 3. استرجاع بيانات الوردية من السيرفر
// ==========================================
const startShiftModal = document.getElementById('startShiftModal');

async function checkActiveShift() {
    try {
        const q = query(collection(db, "shifts"), where("status", "==", "active"), limit(1));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            const shiftDoc = snap.docs[0];
            currentShift = { id: shiftDoc.id, active: true, ...shiftDoc.data() };
            
            // التأكد من وجود قيمة لمصروفات الكاشير للورديات القديمة
            if(currentShift.cashierExpenses === undefined) currentShift.cashierExpenses = 0;
            
            startShiftModal.style.display = 'none';
            document.getElementById('shiftInfoDisplay').innerText = `الكاشير: ${currentShift.cashierName} | العهدة: ${currentShift.startCash} ج`;
            
            loadQuickItemsPos(); // تحميل القائمة السريعة
        } else {
            startShiftModal.style.display = 'flex';
        }
    } catch (error) {
        console.error("Error checking shift:", error);
        startShiftModal.style.display = 'flex';
    }
}

// استدعاء الدالة فور تشغيل الموقع
checkActiveShift();

// ==========================================
// 4. التنقل ونظام الحماية (المدير والوردية)
// ==========================================
const navPosBtn = document.getElementById('navPosBtn');
const navAdminBtn = document.getElementById('navAdminBtn');
const posSection = document.getElementById('posSection');
const adminSection = document.getElementById('adminSection');
const authModal = document.getElementById('authModal');
const adminSubMenu = document.getElementById('adminSubMenu');

// فتح شاشة البيع
navPosBtn.addEventListener('click', () => {
    posSection.style.display = 'block';
    adminSection.style.display = 'none';
    navPosBtn.classList.add('active');
    navAdminBtn.classList.remove('active');
    
    adminSubMenu.style.display = 'none';
    navAdminBtn.innerText = "لوحة الإدارة (مغلق)";
    
    if (!currentShift.active) {
        startShiftModal.style.display = 'flex';
    } else {
        document.getElementById('barcodeInput').focus();
    }
    closeSidebar();
});

// فتح نافذة الباسورد للمدير
navAdminBtn.addEventListener('click', () => {
    if (adminSection.style.display === 'block') {
        closeSidebar();
        return;
    }
    authModal.style.display = 'flex';
    document.getElementById('adminPasswordInput').focus();
    closeSidebar();
});

document.getElementById('openAdminFromShiftBtn').addEventListener('click', () => {
    startShiftModal.style.display = 'none';
    authModal.style.display = 'flex';
    document.getElementById('adminPasswordInput').focus();
});

document.getElementById('closeAuthBtn').addEventListener('click', () => {
    authModal.style.display = 'none';
    document.getElementById('adminPasswordInput').value = '';
    if (!currentShift.active && posSection.style.display !== 'none') {
        startShiftModal.style.display = 'flex';
    }
});

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
        
        navAdminBtn.innerText = "لوحة الإدارة (مفتوح)";
        navAdminBtn.classList.add('active');
        navPosBtn.classList.remove('active');
        adminSubMenu.style.display = 'flex'; 
        
        document.getElementById('adminPasswordInput').value = '';
        loadInventory();
        openSidebar(); 
    } else {
        alert("كلمة المرور غير صحيحة!");
    }
}

// تبويبات الإدارة المنسدلة (تمت إضافة التبويبات الجديدة)
document.getElementById('navInventoryBtn').addEventListener('click', () => { switchAdminTab('inventoryTab', 'navInventoryBtn'); closeSidebar(); });
document.getElementById('navRestockBtn').addEventListener('click', () => { switchAdminTab('restockTab', 'navRestockBtn'); closeSidebar(); });
document.getElementById('navQuickItemsBtn').addEventListener('click', () => { switchAdminTab('quickItemsTab', 'navQuickItemsBtn'); loadQuickItemsAdmin(); closeSidebar(); });
document.getElementById('navExpensesBtn').addEventListener('click', () => { switchAdminTab('expensesTab', 'navExpensesBtn'); closeSidebar(); });
document.getElementById('navCashiersBtn').addEventListener('click', () => { switchAdminTab('cashiersTab', 'navCashiersBtn'); loadCashiers(); closeSidebar(); });
document.getElementById('navStatsBtn').addEventListener('click', () => { switchAdminTab('statsTab', 'navStatsBtn'); loadStats(); closeSidebar(); });

function switchAdminTab(tabId, btnId) {
    document.getElementById('inventoryTab').style.display = 'none';
    document.getElementById('restockTab').style.display = 'none';
    document.getElementById('quickItemsTab').style.display = 'none';
    document.getElementById('expensesTab').style.display = 'none';
    document.getElementById('cashiersTab').style.display = 'none';
    document.getElementById('statsTab').style.display = 'none';
    
    document.getElementById('navInventoryBtn').classList.remove('active-sub');
    document.getElementById('navRestockBtn').classList.remove('active-sub');
    document.getElementById('navQuickItemsBtn').classList.remove('active-sub');
    document.getElementById('navExpensesBtn').classList.remove('active-sub');
    document.getElementById('navCashiersBtn').classList.remove('active-sub');
    document.getElementById('navStatsBtn').classList.remove('active-sub');

    document.getElementById(tabId).style.display = 'block';
    document.getElementById(btnId).classList.add('active-sub');
}

// ==========================================
// 5. إدارة الوردية ومصروفات الكاشير
// ==========================================

document.getElementById('startShiftBtn').addEventListener('click', async () => {
    const name = document.getElementById('cashierNameInput').value.trim();
    const pass = document.getElementById('cashierPasswordInput').value.trim();
    const startCash = parseFloat(document.getElementById('startCashInput').value);

    if (!name || !pass || isNaN(startCash)) {
        alert("برجاء استكمال جميع البيانات!");
        return;
    }

    const btn = document.getElementById('startShiftBtn');
    btn.innerText = "جاري الاتصال بالسيرفر...";
    btn.disabled = true;

    try {
        const q = query(collection(db, "cashiers"), where("name", "==", name), where("password", "==", pass));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("اسم الكاشير أو كلمة المرور غير صحيحة!");
            window.playSound('error');
        } else {
            const shiftData = {
                status: "active",
                cashierName: name,
                startCash: startCash,
                sales: 0,
                drops: 0,
                cashierExpenses: 0,
                startTime: new Date().toISOString()
            };
            
            const docRef = await addDoc(collection(db, "shifts"), shiftData);
            
            currentShift = { id: docRef.id, active: true, ...shiftData };
            
            startShiftModal.style.display = 'none';
            document.getElementById('shiftInfoDisplay').innerText = `الكاشير: ${name} | العهدة: ${startCash} ج`;
            window.playSound('success');
            loadQuickItemsPos();
            document.getElementById('barcodeInput').focus();
        }
    } catch (error) {
        alert("حدث خطأ في الاتصال بقاعدة البيانات.");
    } finally {
        btn.innerText = "استلام الوردية";
        btn.disabled = false;
    }
});

// تسليم نقدية للمدير
const cashDropModal = document.getElementById('cashDropModal');
document.getElementById('navCashDropBtn').addEventListener('click', () => {
    if (!currentShift.active) return alert("لا توجد وردية مفتوحة!");
    cashDropModal.style.display = 'flex';
    closeSidebar();
});
document.getElementById('closeDropBtn').addEventListener('click', () => {
    cashDropModal.style.display = 'none';
});

document.getElementById('confirmDropBtn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('dropAmountInput').value);
    const pass = document.getElementById('dropAdminPassword').value;

    if (isNaN(amount) || amount <= 0 || !pass) {
        alert("برجاء إدخال المبلغ وكلمة المرور بشكل صحيح.");
        return;
    }

    if (pass === ADMIN_PASSWORD) {
        const btn = document.getElementById('confirmDropBtn');
        btn.innerText = "جاري الحفظ...";
        btn.disabled = true;

        try {
            currentShift.drops += amount;
            await updateDoc(doc(db, "shifts", currentShift.id), { drops: currentShift.drops });
            
            alert(`تم تسليم مبلغ ${amount} جنيه للمدير بنجاح.`);
            cashDropModal.style.display = 'none';
            document.getElementById('dropAmountInput').value = '';
            document.getElementById('dropAdminPassword').value = '';
            window.playSound('success');
        } catch (error) {
            alert("حدث خطأ أثناء الحفظ في السيرفر!");
            currentShift.drops -= amount; 
        } finally {
            btn.innerText = "تأكيد السحب";
            btn.disabled = false;
        }
    } else {
        alert("كلمة مرور المدير غير صحيحة!");
        window.playSound('error');
    }
});

// ميزة جديدة: مصروفات الكاشير (النثرية)
const cashierExpenseModal = document.getElementById('cashierExpenseModal');
document.getElementById('openCashierExpenseBtn').addEventListener('click', () => {
    cashierExpenseModal.style.display = 'flex';
});
document.getElementById('closeCashierExpBtn').addEventListener('click', () => {
    cashierExpenseModal.style.display = 'none';
});
document.getElementById('confirmCashierExpBtn').addEventListener('click', async () => {
    const title = document.getElementById('cashierExpTitle').value.trim();
    const amount = parseFloat(document.getElementById('cashierExpAmount').value);

    if (!title || isNaN(amount) || amount <= 0) return alert("برجاء إدخال البيانات بشكل صحيح.");
    
    try {
        currentShift.cashierExpenses += amount;
        
        const batch = writeBatch(db);
        // تحديث الوردية
        batch.update(doc(db, "shifts", currentShift.id), { cashierExpenses: currentShift.cashierExpenses });
        // إضافة المصروف للإحصائيات العامة للمدير
        batch.set(doc(collection(db, "expenses")), { 
            title: `(وردية الكاشير) ${title}`, 
            amount: amount, 
            date: new Date().toISOString() 
        });
        // تحديث الإجمالي اللحظي
        batch.set(doc(db, "stats", "financials"), { totalExpenses: increment(amount) }, { merge: true });
        
        await batch.commit();
        
        alert("تم تسجيل المصروف وخصمه من الدرج.");
        cashierExpenseModal.style.display = 'none';
        document.getElementById('cashierExpTitle').value = '';
        document.getElementById('cashierExpAmount').value = '';
        window.playSound('success');
    } catch (error) {
        alert("خطأ في تسجيل المصروف.");
        currentShift.cashierExpenses -= amount;
    }
});

// تقفيل الوردية
const endShiftModal = document.getElementById('endShiftModal');
document.getElementById('navEndShiftBtn').addEventListener('click', () => {
    if (!currentShift.active) return alert("لا توجد وردية مفتوحة!");
    
    document.getElementById('reportStartCash').innerText = currentShift.startCash;
    document.getElementById('reportSales').innerText = currentShift.sales;
    document.getElementById('reportDrops').innerText = currentShift.drops;
    document.getElementById('reportCashierExpenses').innerText = currentShift.cashierExpenses;
    
    const expected = currentShift.startCash + currentShift.sales - currentShift.drops - currentShift.cashierExpenses;
    document.getElementById('reportExpectedCash').innerText = expected;

    endShiftModal.style.display = 'flex';
    closeSidebar();
});
document.getElementById('closeEndShiftBtn').addEventListener('click', () => {
    endShiftModal.style.display = 'none';
});

document.getElementById('confirmEndShiftBtn').addEventListener('click', async () => {
    const btn = document.getElementById('confirmEndShiftBtn');
    btn.innerText = "جاري إغلاق الوردية...";
    btn.disabled = true;

    try {
        await updateDoc(doc(db, "shifts", currentShift.id), {
            status: "closed",
            endTime: new Date().toISOString()
        });

        currentShift = { id: null, active: false, cashierName: "", startCash: 0, sales: 0, drops: 0, cashierExpenses: 0, startTime: null };
        document.getElementById('shiftInfoDisplay').innerText = '';
        endShiftModal.style.display = 'none';
        
        if (posSection.style.display !== 'none') {
            startShiftModal.style.display = 'flex';
        }
        
        document.getElementById('cashierPasswordInput').value = '';
        document.getElementById('startCashInput').value = '';
        window.playSound('success');
        alert("تم تقفيل الوردية بنجاح.");
    } catch (error) {
        alert("حدث خطأ أثناء الاتصال بالسيرفر لإغلاق الوردية!");
    } finally {
        btn.innerText = "إنهاء الوردية وبدء وردية جديدة";
        btn.disabled = false;
    }
});

// ==========================================
// 6. إدارة المخزن، تزويد البضاعة، والقائمة السريعة
// ==========================================
document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = "جاري الإضافة...";
    btn.disabled = true;

    const nameVal = document.getElementById('prodName').value;

    const newProduct = {
        barcode: document.getElementById('prodBarcode').value,
        name: nameVal,
        searchKey: normalizeArabic(nameVal), // ميزة البحث المرن
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
        btn.innerText = "إضافة المنتج";
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

// ميزة جديدة: تزويد البضاعة وحساب متوسط التكلفة
let currentRestockProduct = null;
const restockBarcode = document.getElementById('restockBarcode');
const restockInfo = document.getElementById('restockProductInfo');
const restockQty = document.getElementById('restockQty');
const restockBuyPrice = document.getElementById('restockBuyPrice');
const restockSubmitBtn = document.getElementById('restockSubmitBtn');

restockBarcode.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const code = restockBarcode.value.trim();
        const q = query(collection(db, "products"), where("barcode", "==", code), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
            currentRestockProduct = { id: snap.docs[0].id, ...snap.docs[0].data() };
            restockInfo.style.display = 'block';
            restockInfo.innerHTML = `<h4>${currentRestockProduct.name}</h4>
                                     <p>الكمية الحالية: ${currentRestockProduct.quantity} | سعر الشراء الحالي: ${currentRestockProduct.buyPrice} ج</p>`;
            restockQty.disabled = false;
            restockBuyPrice.disabled = false;
            restockSubmitBtn.disabled = false;
            restockQty.focus();
        } else {
            alert("المنتج غير موجود بالمخزن!");
            currentRestockProduct = null;
        }
    }
});

document.getElementById('restockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentRestockProduct) return;

    const addedQty = parseInt(restockQty.value);
    let newPriceInput = restockBuyPrice.value.trim();
    let finalBuyPrice = currentRestockProduct.buyPrice;

    if (newPriceInput !== "" && !isNaN(newPriceInput)) {
        const newPrice = parseFloat(newPriceInput);
        const oldTotalVal = currentRestockProduct.quantity * currentRestockProduct.buyPrice;
        const newTotalVal = addedQty * newPrice;
        const totalQty = currentRestockProduct.quantity + addedQty;
        finalBuyPrice = (oldTotalVal + newTotalVal) / totalQty;
        finalBuyPrice = Math.round(finalBuyPrice * 100) / 100;
    }

    try {
        restockSubmitBtn.disabled = true;
        await updateDoc(doc(db, "products", currentRestockProduct.id), {
            quantity: currentRestockProduct.quantity + addedQty,
            buyPrice: finalBuyPrice
        });
        alert(`تم التزويد بنجاح! متوسط التكلفة الجديد: ${finalBuyPrice} ج`);
        document.getElementById('restockForm').reset();
        restockInfo.style.display = 'none';
        restockQty.disabled = true; 
        restockBuyPrice.disabled = true; 
        restockSubmitBtn.disabled = true;
        currentRestockProduct = null;
        loadInventory();
    } catch (error) {
        alert("حدث خطأ أثناء التزويد.");
        restockSubmitBtn.disabled = false;
    }
});

// ميزة جديدة: القائمة السريعة
document.getElementById('addQuickItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const barcode = document.getElementById('quickItemBarcode').value.trim();
    const file = document.getElementById('quickItemImage').files[0];
    
    if (!file) return alert("اختر صورة.");

    const reader = new FileReader();
    reader.onload = async function(event) {
        const base64Img = event.target.result;
        try {
            const q = query(collection(db, "products"), where("barcode", "==", barcode), limit(1));
            const snap = await getDocs(q);
            if(snap.empty) return alert("الباركود غير موجود بالمخزن.");
            
            const prodData = snap.docs[0].data();
            await addDoc(collection(db, "quick_items"), {
                barcode: barcode,
                name: prodData.name,
                image: base64Img
            });
            alert("تم إضافة المنتج للقائمة السريعة.");
            document.getElementById('addQuickItemForm').reset();
            loadQuickItemsAdmin();
        } catch(err) {
            alert("خطأ في الحفظ.");
        }
    };
    reader.readAsDataURL(file);
});

async function loadQuickItemsAdmin() {
    const list = document.getElementById('adminQuickItemsList');
    list.innerHTML = 'جاري التحميل...';
    const snap = await getDocs(collection(db, "quick_items"));
    list.innerHTML = '';
    snap.forEach(doc => {
        const data = doc.data();
        list.innerHTML += `<div class="quick-item-btn" style="cursor:default;">
            <img src="${data.image}"><span>${data.name}</span>
            <button onclick="alert('حذف قريباً')" style="background:var(--danger-color); padding: 5px; font-size: 0.8rem; width:100%;">حذف</button>
        </div>`;
    });
}

async function loadQuickItemsPos() {
    const area = document.getElementById('quickItemsArea');
    area.innerHTML = '';
    const snap = await getDocs(collection(db, "quick_items"));
    snap.forEach(doc => {
        const data = doc.data();
        area.innerHTML += `
            <div class="quick-item-btn" onclick="addQuickItemToCart('${data.barcode}')">
                <img src="${data.image}" alt="${data.name}">
                <span>${data.name}</span>
            </div>`;
    });
}

window.addQuickItemToCart = async function(barcode) {
    const barcodeInput = document.getElementById('barcodeInput');
    barcodeInput.value = barcode;
    barcodeInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter' }));
};

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
// 7. شاشة البيع، منع التكرار، وتأكيد الفاتورة
// ==========================================

const barcodeInput = document.getElementById('barcodeInput');
let lastPosInputTime = 0;
let lastPosInputValue = "";

barcodeInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const code = barcodeInput.value.trim();
        if(code === "") return;

        // ميزة جديدة: منع التكرار (Debounce) لمدة 4 ثوانٍ
        const now = new Date().getTime();
        if (code === lastPosInputValue && (now - lastPosInputTime) < 4000) {
            barcodeInput.value = ''; 
            return;
        }
        lastPosInputValue = code;
        lastPosInputTime = now;

        try {
            // البحث الدقيق بالباركود أولاً
            let q = query(collection(db, "products"), where("barcode", "==", code), limit(1));
            let querySnapshot = await getDocs(q);

            // البحث المرن بالاسم (إذا لم ينجح الباركود)
            if (querySnapshot.empty) {
                const normalizedSearch = normalizeArabic(code);
                q = query(collection(db, "products"), where("searchKey", ">=", normalizedSearch), where("searchKey", "<=", normalizedSearch + '\uf8ff'), limit(1));
                querySnapshot = await getDocs(q);
            }

            if (!querySnapshot.empty) {
                const productDoc = querySnapshot.docs[0];
                let product = productDoc.data();
                product.id = productDoc.id;
                addToCart(product);
                barcodeInput.value = '';
            } else {
                window.playSound('error');
                alert("المنتج غير موجود!");
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
        cashier: currentShift.cashierName,
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

        const shiftRef = doc(db, "shifts", currentShift.id);
        batch.update(shiftRef, { sales: currentShift.sales + totalSales });

        // ميزة جديدة: تحديث الإحصائيات المركزية لحظياً
        const statsRef = doc(db, "stats", "financials");
        batch.set(statsRef, { 
            totalSales: increment(totalSales), 
            totalCost: increment(totalCost) 
        }, { merge: true });

        await batch.commit();

        currentShift.sales += totalSales; 

        window.playSound('success'); 
        alert("تم البيع وحفظ الفاتورة بنجاح!");
        cart = [];
        renderCart();
        document.getElementById('barcodeInput').focus();

    } catch (error) {
        console.error(error);
        window.playSound('error'); 
        alert("حدث خطأ! لم يتم حفظ الفاتورة.");
    } finally {
        btn.innerText = "تأكيد البيع وحفظ الفاتورة";
        btn.disabled = false;
    }
});

// ==========================================
// 8. المصروفات والإحصائيات السريعة
// ==========================================
document.getElementById('addExpenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = "جاري التسجيل...";
    btn.disabled = true;

    const amount = parseFloat(document.getElementById('expAmount').value);
    const newExpense = {
        title: document.getElementById('expTitle').value,
        amount: amount,
        date: new Date().toISOString()
    };

    try {
        const batch = writeBatch(db);
        const expRef = doc(collection(db, "expenses"));
        batch.set(expRef, newExpense);
        
        // تحديث الإحصائيات المركزية لحظياً
        const statsRef = doc(db, "stats", "financials");
        batch.set(statsRef, { totalExpenses: increment(amount) }, { merge: true });

        await batch.commit();

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
        // ميزة جديدة: قراءة الإحصائيات بسرعة فائقة من ملف واحد بدلاً من كل الفواتير
        const docSnap = await getDoc(doc(db, "stats", "financials"));
        if(docSnap.exists()) {
            const data = docSnap.data();
            const totalSales = data.totalSales || 0;
            const totalCost = data.totalCost || 0;
            const totalExpenses = data.totalExpenses || 0;
            
            const netProfit = (totalSales - totalCost) - totalExpenses;
            
            document.getElementById('totalSalesStat').innerText = totalSales + " جنيه";
            document.getElementById('totalExpensesStat').innerText = totalExpenses + " جنيه";
            
            const netProfitEl = document.getElementById('netProfitStat');
            netProfitEl.innerText = netProfit + " جنيه";
            netProfitEl.style.color = netProfit >= 0 ? "var(--success-color)" : "var(--danger-color)";
        }
    } catch (error) {
        console.error("Error loading stats: ", error);
    }
}

// ==========================================
// 9. القائمة الجانبية والصوتيات
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

const successSound = document.getElementById('successSound');
const errorSound = document.getElementById('errorSound');

window.playSound = function(type) {
    try {
        if (type === 'success') { successSound.currentTime = 0; successSound.play(); }
        else if (type === 'error') { errorSound.currentTime = 0; errorSound.play(); }
    } catch (error) {}
};

// ==========================================
// 10. الكاميرا المتقدمة وحفظ حالة الإغلاق
// ==========================================
const startCameraBtn = document.getElementById('startCameraBtn');
const readerDiv = document.getElementById('reader');
const autoCloseCheckbox = document.getElementById('autoCloseScanner');
let html5QrCode;
let isCameraOpen = false;

// متغيرات للتحكم في المسح المتتالي
let lastScanTime = 0;
let lastScannedCode = "";

// استرجاع حالة خيار الإغلاق التلقائي
autoCloseCheckbox.checked = localStorage.getItem('autoCloseScanner') === 'true';
autoCloseCheckbox.addEventListener('change', (e) => localStorage.setItem('autoCloseScanner', e.target.checked));


startCameraBtn.addEventListener('click', () => {
    if (isCameraOpen) {
        html5QrCode.stop().then(() => {
            readerDiv.style.display = 'none';
            isCameraOpen = false;
            startCameraBtn.innerHTML = '📷'; 
            readerDiv.style.boxShadow = "none"; 
        }).catch(err => console.log("خطأ في إغلاق الكاميرا"));
    } else {
        readerDiv.style.display = 'block';
        html5QrCode = new window.Html5Qrcode("reader");
        
        const cameraConfig = { fps: 30, qrbox: { width: 250, height: 100 } };
        const videoConstraints = { facingMode: "environment" };

        html5QrCode.start(
            videoConstraints, 
            cameraConfig,
            (decodedText) => {
                const currentTime = new Date().getTime();
                
                if (decodedText === lastScannedCode && (currentTime - lastScanTime) < 4000) {
                    return; 
                }

                lastScanTime = currentTime;
                lastScannedCode = decodedText;
                
                const barcodeInput = document.getElementById('barcodeInput');
                barcodeInput.value = decodedText;
                
                window.playSound('success');
                
                readerDiv.style.transition = "box-shadow 0.2s ease";
                readerDiv.style.boxShadow = "0px 0px 20px 5px var(--success-color)";
                
                setTimeout(() => { readerDiv.style.boxShadow = "none"; }, 500);

                barcodeInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter' }));

                // الإغلاق التلقائي إذا كان الخيار مفعلاً
                if (autoCloseCheckbox.checked) {
                    html5QrCode.stop().then(() => { 
                        readerDiv.style.display = 'none'; 
                        isCameraOpen = false; 
                        startCameraBtn.innerHTML = '📷'; 
                    });
                }
            },
            (errorMessage) => {} 
        ).then(() => {
            isCameraOpen = true;
            startCameraBtn.innerHTML = '❌ إغلاق الكاميرا';
        }).catch(() => {
            alert("برجاء السماح للمتصفح باستخدام الكاميرا!");
            readerDiv.style.display = 'none';
        });
    }
});

// كاميرا إضافة المنتجات للمخزن
const startProdCameraBtn = document.getElementById('startProdCameraBtn');
const prodReaderDiv = document.getElementById('prodReader');
const prodBarcode = document.getElementById('prodBarcode');

let prodHtml5QrCode;
let isProdCameraOpen = false;

startProdCameraBtn.addEventListener('click', () => {
    if (isProdCameraOpen) {
        prodHtml5QrCode.stop().then(() => {
            prodReaderDiv.style.display = 'none';
            isProdCameraOpen = false;
            startProdCameraBtn.innerHTML = '📷'; 
        }).catch(err => console.log("خطأ في إغلاق الكاميرا"));
    } else {
        prodReaderDiv.style.display = 'block';
        prodHtml5QrCode = new window.Html5Qrcode("prodReader");
        
        const cameraConfig = { fps: 30, qrbox: { width: 250, height: 100 } };

        prodHtml5QrCode.start(
            { facingMode: "environment" }, 
            cameraConfig,
            (decodedText) => {
                prodBarcode.value = decodedText; 
                window.playSound('success'); 
                
                prodHtml5QrCode.stop().then(() => {
                    prodReaderDiv.style.display = 'none';
                    isProdCameraOpen = false;
                    startProdCameraBtn.innerHTML = '📷';
                    
                    document.getElementById('prodName').focus();
                });
            },
            (errorMessage) => {} 
        ).then(() => {
            isProdCameraOpen = true;
            startProdCameraBtn.innerHTML = '❌'; 
        }).catch(() => {
            alert("برجاء السماح للمتصفح باستخدام الكاميرا!");
            prodReaderDiv.style.display = 'none';
        });
    }
});
