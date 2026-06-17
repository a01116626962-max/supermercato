// ==========================================
// 1. استدعاء مكتبات Firebase
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, query, where, limit, writeBatch, increment, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
    cashierExpenses: 0,
    startTime: null
};

// إعدادات Debounce للباركود
const barcodeDebounceTimers = {};

// ==========================================
// 3. دوال مساعدة (Utility Functions)
// ==========================================

// توحيد النص العربي للبحث المرن
function normalizeText(text) {
    if (!text) return "";
    return text
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[^\u0621-\u063A\u0641-\u064Aa-zA-Z0-9\s]/g, '')
        .trim()
        .toLowerCase();
}

// إنشاء مفتاح بحث آمن للمنتج
function createSearchKey(name) {
    return normalizeText(name);
}

// ➕ تحويل ملف صورة إلى Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

// ➕ ضغط الصورة قبل تحويلها لـ Base64 (لتقليل الحجم)
function compressImage(file, maxWidth = 200, maxHeight = 200, quality = 0.5) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // حساب الأبعاد الجديدة مع الحفاظ على النسبة
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ==========================================
// 4. التنقل ونظام الحماية (المدير والوردية)
// ==========================================

const navPosBtn = document.getElementById('navPosBtn');
const navAdminBtn = document.getElementById('navAdminBtn');
const posSection = document.getElementById('posSection');
const adminSection = document.getElementById('adminSection');
const authModal = document.getElementById('authModal');
const startShiftModal = document.getElementById('startShiftModal');

// إظهار أقسام الإدارة
const allAdminTabs = [
    'inventoryTab', 'expensesTab', 'cashiersTab', 'statsTab', 'restockTab', 'quickItemsAdminTab'
];

function hideAllAdminTabs() {
    allAdminTabs.forEach(tabId => {
        const tab = document.getElementById(tabId);
        if (tab) tab.style.display = 'none';
    });
}

// فتح شاشة البيع
navPosBtn.addEventListener('click', () => {
    posSection.style.display = 'block';
    adminSection.style.display = 'none';
    navPosBtn.classList.add('active');
    navAdminBtn.classList.remove('active');
    
    if (!currentShift.active) {
        startShiftModal.style.display = 'flex';
    } else {
        document.getElementById('barcodeInput').focus();
        loadQuickItems();
    }
    closeSidebar();
});

// فتح نافذة الباسورد للمدير
navAdminBtn.addEventListener('click', () => {
    authModal.style.display = 'flex';
    document.getElementById('adminPasswordInput').focus();
    closeSidebar();
});

// زر الدخول للإدارة من شاشة الوردية
document.getElementById('openAdminFromShiftBtn').addEventListener('click', () => {
    startShiftModal.style.display = 'none';
    authModal.style.display = 'flex';
    document.getElementById('adminPasswordInput').focus();
});

// إغلاق نافذة الإدارة
document.getElementById('closeAuthBtn').addEventListener('click', () => {
    authModal.style.display = 'none';
    document.getElementById('adminPasswordInput').value = '';
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
        hideAllAdminTabs();
        document.getElementById('inventoryTab').style.display = 'block';
        loadInventory();
    } else {
        alert("كلمة المرور غير صحيحة!");
    }
}

// تبويبات الإدارة
function switchAdminTab(tabId) {
    hideAllAdminTabs();
    const tab = document.getElementById(tabId);
    if (tab) tab.style.display = 'block';
    
    if (tabId === 'inventoryTab') loadInventory();
    else if (tabId === 'cashiersTab') loadCashiers();
    else if (tabId === 'statsTab') loadStats();
    else if (tabId === 'quickItemsAdminTab') loadQuickItemsAdmin();
    else if (tabId === 'restockTab') {
        document.getElementById('restockForm').reset();
        document.getElementById('restockProdName').value = '';
    }
}

// ربط أزرار القائمة الجانبية
document.getElementById('navInventoryBtn').addEventListener('click', () => {
    if (!checkAdminAccess()) return;
    switchAdminTab('inventoryTab');
    closeSidebar();
});

document.getElementById('navExpensesBtn').addEventListener('click', () => {
    if (!checkAdminAccess()) return;
    switchAdminTab('expensesTab');
    closeSidebar();
});

document.getElementById('navCashiersBtn').addEventListener('click', () => {
    if (!checkAdminAccess()) return;
    switchAdminTab('cashiersTab');
    closeSidebar();
});

document.getElementById('navStatsBtn').addEventListener('click', () => {
    if (!checkAdminAccess()) return;
    switchAdminTab('statsTab');
    closeSidebar();
});

document.getElementById('navRestockBtn').addEventListener('click', () => {
    if (!checkAdminAccess()) return;
    switchAdminTab('restockTab');
    closeSidebar();
});

document.getElementById('navQuickItemsAdminBtn').addEventListener('click', () => {
    if (!checkAdminAccess()) return;
    switchAdminTab('quickItemsAdminTab');
    closeSidebar();
});

document.getElementById('navCashierExpBtn').addEventListener('click', () => {
    if (!currentShift.active) return alert("لا توجد وردية مفتوحة!");
    document.getElementById('cashierExpenseModal').style.display = 'flex';
    closeSidebar();
});

function checkAdminAccess() {
    if (adminSection.style.display === 'none' || adminSection.style.display === '') {
        authModal.style.display = 'flex';
        document.getElementById('adminPasswordInput').focus();
        return false;
    }
    return true;
}

// ==========================================
// 5. إدارة الوردية (بدء - سحب - مصروفات - إنهاء)
// ==========================================

// بدء الوردية
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
        const q = query(collection(db, "cashiers"), where("name", "==", name), where("password", "==", pass));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("اسم الكاشير أو كلمة المرور غير صحيحة!");
            window.playSound('error');
        } else {
            currentShift = {
                active: true,
                cashierName: name,
                startCash: startCash,
                sales: 0,
                drops: 0,
                cashierExpenses: 0,
                startTime: new Date().toISOString()
            };
            
            startShiftModal.style.display = 'none';
            document.getElementById('shiftInfoDisplay').innerText = `الكاشير: ${name} | العهدة: ${startCash} ج`;
            window.playSound('success');
            document.getElementById('barcodeInput').focus();
            loadQuickItems();
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

// تأكيد السحب مع منع الرصيد بالسالب
document.getElementById('confirmDropBtn').addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('dropAmountInput').value);
    const pass = document.getElementById('dropAdminPassword').value;

    if (isNaN(amount) || amount <= 0 || !pass) {
        alert("برجاء إدخال المبلغ وكلمة المرور بشكل صحيح.");
        return;
    }

    const availableCash = currentShift.startCash + currentShift.sales - currentShift.drops - (currentShift.cashierExpenses || 0);
    if (amount > availableCash) {
        return alert(`الرصيد المتاح (${availableCash} ج) لا يكفي`);
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

// مصروفات الكاشير (النثرية)
document.getElementById('confirmCashierExpBtn').addEventListener('click', async () => {
    const title = document.getElementById('cashierExpTitle').value.trim();
    const amount = parseFloat(document.getElementById('cashierExpAmount').value);
    
    if (!title || isNaN(amount) || amount <= 0) return alert("بيانات غير صحيحة");
    
    const availableCash = currentShift.startCash + currentShift.sales - currentShift.drops - (currentShift.cashierExpenses || 0);
    if (amount > availableCash) {
        return alert(`الرصيد المتاح (${availableCash} ج) لا يكفي`);
    }
    
    currentShift.cashierExpenses += amount;
    
    try {
        await addDoc(collection(db, "cashierExpenses"), {
            title: title,
            amount: amount,
            cashier: currentShift.cashierName,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("خطأ في حفظ المصروف:", error);
    }
    
    document.getElementById('cashierExpenseModal').style.display = 'none';
    document.getElementById('cashierExpTitle').value = '';
    document.getElementById('cashierExpAmount').value = '';
    alert(`تم تسجيل مصروف ${title} بقيمة ${amount} ج`);
    window.playSound('success');
});

document.getElementById('closeCashierExpBtn').addEventListener('click', () => {
    document.getElementById('cashierExpenseModal').style.display = 'none';
});

// تقفيل الوردية
const endShiftModal = document.getElementById('endShiftModal');
document.getElementById('navEndShiftBtn').addEventListener('click', () => {
    if (!currentShift.active) return alert("لا توجد وردية مفتوحة!");
    
    document.getElementById('reportStartCash').innerText = currentShift.startCash;
    document.getElementById('reportSales').innerText = currentShift.sales;
    document.getElementById('reportDrops').innerText = currentShift.drops;
    document.getElementById('reportCashierExpenses').innerText = currentShift.cashierExpenses || 0;
    
    const expected = currentShift.startCash + currentShift.sales - currentShift.drops - (currentShift.cashierExpenses || 0);
    document.getElementById('reportExpectedCash').innerText = expected;

    endShiftModal.style.display = 'flex';
    closeSidebar();
});
document.getElementById('closeEndShiftBtn').addEventListener('click', () => {
    endShiftModal.style.display = 'none';
});

// تأكيد التقفيل مع تقرير شامل
document.getElementById('confirmEndShiftBtn').addEventListener('click', async () => {
    const btn = document.getElementById('confirmEndShiftBtn');
    btn.innerText = "جاري الحفظ...";
    btn.disabled = true;

    try {
        const expectedCash = currentShift.startCash + currentShift.sales - currentShift.drops - (currentShift.cashierExpenses || 0);
        const actualCashInput = prompt("أدخل النقدية الفعلية الموجودة بالدرج الآن:", expectedCash);
        const actualCash = parseFloat(actualCashInput);
        
        if (isNaN(actualCash)) {
            alert("لم يتم إدخال قيمة صحيحة، سيتم افتراض أن النقدية الفعلية تساوي المتوقعة.");
        }
        
        const difference = actualCash - expectedCash;

        const shiftData = {
            ...currentShift,
            endTime: new Date().toISOString(),
            actualCash: actualCash || expectedCash,
            expectedCash: expectedCash,
            difference: difference || 0,
            status: (difference || 0) >= 0 ? 'زيادة' : 'عجز'
        };
        
        await addDoc(collection(db, "shifts"), shiftData);

        currentShift = { active: false, cashierName: "", startCash: 0, sales: 0, drops: 0, cashierExpenses: 0, startTime: null };
        document.getElementById('shiftInfoDisplay').innerText = '';
        endShiftModal.style.display = 'none';
        startShiftModal.style.display = 'flex';
        
        document.getElementById('cashierPasswordInput').value = '';
        document.getElementById('startCashInput').value = '';
        
        window.playSound('success');
        const diffMsg = (difference || 0) >= 0 ? `زيادة: ${Math.abs(difference || 0)} ج` : `عجز: ${Math.abs(difference || 0)} ج`;
        alert(`تم تقفيل الوردية بنجاح. ${diffMsg}`);
    } catch (error) {
        console.error("End Shift Error:", error);
        alert("حدث خطأ أثناء حفظ تقرير الوردية!");
    } finally {
        btn.innerText = "إنهاء الوردية وبدء وردية جديدة";
        btn.disabled = false;
    }
});

// ==========================================
// 6. إدارة المخزن (مع Base64 للصور)
// ==========================================

document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = "جاري الإضافة...";
    btn.disabled = true;

    // ➕ معالجة الصورة إذا وُجدت
    let imageBase64 = "";
    const imageFile = document.getElementById('prodImage')?.files[0];
    if (imageFile) {
        try {
            btn.innerText = "جاري ضغط الصورة...";
            imageBase64 = await compressImage(imageFile, 200, 200, 0.5);
        } catch (error) {
            console.error("خطأ في معالجة الصورة:", error);
        }
    }

    const newProduct = {
        barcode: document.getElementById('prodBarcode').value,
        name: document.getElementById('prodName').value,
        buyPrice: parseFloat(document.getElementById('prodBuyPrice').value),
        sellPrice: parseFloat(document.getElementById('prodSellPrice').value),
        quantity: parseInt(document.getElementById('prodQty').value),
        minAlert: parseInt(document.getElementById('prodMinAlert').value),
        image: imageBase64, // ➕ حفظ الصورة Base64
        searchKey: [
            normalizeText(document.getElementById('prodName').value),
            normalizeText(document.getElementById('prodBarcode').value)
        ]
    };

    try {
        await addDoc(collection(db, "products"), newProduct);
        alert("تمت إضافة المنتج بنجاح!");
        document.getElementById('addProductForm').reset();
        loadInventory();
    } catch (error) {
        alert("حدث خطأ أثناء الإضافة: " + error.message);
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
            
            // تجاهل المنتجات المحذوفة منطقياً
            if (prod.quantity === -99999) return;
            
            productsList.push(prod);
            let isLowStock = prod.quantity <= prod.minAlert ? 'low-stock' : '';
            tbody.innerHTML += `
                <tr class="${isLowStock}">
                    <td>${prod.barcode}</td>
                    <td>${prod.image ? `<img src="${prod.image}" style="width:30px; height:30px; vertical-align:middle; margin-left:5px;">` : ''}${prod.name}</td>
                    <td>${prod.quantity}</td>
                    <td>${prod.buyPrice}</td>
                    <td>${prod.sellPrice}</td>
                    <td>
                        <button onclick="window.editProduct('${prod.id}')" style="margin-right:5px;">تعديل</button>
                        <button onclick="window.deleteProduct('${prod.id}')" style="background:var(--danger-color)">حذف</button>
                    </td>
                </tr>`;
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6">خطأ في تحميل البيانات</td></tr>';
    }
}

// تفعيل أزرار التعديل والحذف
window.editProduct = async function(productId) {
    const product = productsList.find(p => p.id === productId);
    if (!product) return alert("المنتج غير موجود");
    
    const newName = prompt("اسم المنتج الجديد:", product.name);
    if (!newName) return;
    const newSellPrice = prompt("سعر البيع الجديد:", product.sellPrice);
    if (!newSellPrice) return;
    
    // ➕ اختيار صورة جديدة (اختياري)
    const changeImage = confirm("هل تريد تغيير الصورة أيضاً؟");
    let imageBase64 = product.image || "";
    
    if (changeImage) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        imageBase64 = await new Promise((resolve) => {
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const base64 = await compressImage(file, 200, 200, 0.5);
                    resolve(base64);
                } else {
                    resolve(product.image || "");
                }
            };
            input.click();
        });
    }
    
    try {
        const productRef = doc(db, "products", productId);
        await updateDoc(productRef, {
            name: newName,
            sellPrice: parseFloat(newSellPrice),
            image: imageBase64,
            searchKey: [normalizeText(newName), normalizeText(product.barcode || '')]
        });
        alert("تم التعديل بنجاح");
        loadInventory();
    } catch (error) {
        alert("خطأ في التعديل");
    }
};

window.deleteProduct = async function(productId) {
    if (confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
        try {
            await updateDoc(doc(db, "products", productId), { quantity: -99999 });
            alert("تم الحذف بنجاح");
            loadInventory();
        } catch (error) {
            alert("خطأ في الحذف");
        }
    }
};

// ==========================================
// 7. تزويد البضاعة (Restock) مع متوسط التكلفة
// ==========================================

async function lookupProductForRestock(barcode) {
    const prodNameInput = document.getElementById('restockProdName');
    const addQtyInput = document.getElementById('restockAddQty');
    
    if (!barcode) return;
    
    // بحث محلي أولاً
    const localProduct = productsList.find(p => p.barcode === barcode);
    if (localProduct) {
        prodNameInput.value = localProduct.name;
        prodNameInput.dataset.productId = localProduct.id;
        addQtyInput.focus();
        return;
    }
    
    // بحث في Firebase
    const q = query(collection(db, "products"), where("barcode", "==", barcode), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const prod = snap.docs[0].data();
        prodNameInput.value = prod.name;
        prodNameInput.dataset.productId = snap.docs[0].id;
        addQtyInput.focus();
    } else {
        alert("المنتج غير موجود في المخزن!");
        prodNameInput.value = '';
        prodNameInput.dataset.productId = '';
    }
}

document.getElementById('restockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const barcode = document.getElementById('restockBarcode').value;
    const addQty = parseInt(document.getElementById('restockAddQty').value);
    const newBuyPrice = parseFloat(document.getElementById('restockNewBuyPrice').value) || 0;
    const newSellPrice = parseFloat(document.getElementById('restockNewSellPrice').value) || 0;
    
    if (isNaN(addQty) || addQty <= 0) return alert("الكمية غير صالحة");
    
    try {
        const q = query(collection(db, "products"), where("barcode", "==", barcode), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return alert("المنتج غير موجود!");
        
        const productDoc = snap.docs[0];
        const product = productDoc.data();
        const productRef = doc(db, "products", productDoc.id);
        
        // حساب متوسط التكلفة الجديد
        let updatedData = {
            quantity: increment(addQty)
        };
        
        if (newBuyPrice > 0 && product.buyPrice > 0 && product.quantity > 0) {
            const oldTotalCost = product.buyPrice * product.quantity;
            const newTotalCost = newBuyPrice * addQty;
            const totalQuantity = product.quantity + addQty;
            const newAvgBuyPrice = (oldTotalCost + newTotalCost) / totalQuantity;
            updatedData.buyPrice = Math.round(newAvgBuyPrice * 100) / 100;
        } else if (newBuyPrice > 0) {
            updatedData.buyPrice = newBuyPrice;
        }
        
        if (newSellPrice > 0) {
            updatedData.sellPrice = newSellPrice;
        }
        
        await updateDoc(productRef, updatedData);
        
        document.getElementById('restockForm').reset();
        document.getElementById('restockProdName').value = '';
        alert(`تم تزويد ${product.name} بنجاح. الكمية الجديدة: ${product.quantity + addQty}`);
        loadInventory();
    } catch (error) {
        console.error(error);
        alert("خطأ في التزويد");
    }
});

// ==========================================
// 8. الكاشيرية (مع تفعيل الحذف)
// ==========================================

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
            if (data.active === false) return;
            tbody.innerHTML += `
                <tr>
                    <td>${data.name}</td>
                    <td>${data.password}</td>
                    <td><button style="background:var(--danger-color)" onclick="window.deleteCashier('${doc.id}')">حذف</button></td>
                </tr>`;
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="3">خطأ في تحميل البيانات</td></tr>';
    }
}

window.deleteCashier = async function(cashierId) {
    if (confirm("هل أنت متأكد من حذف هذا الكاشير؟")) {
        try {
            await updateDoc(doc(db, "cashiers", cashierId), { active: false });
            alert("تم الحذف بنجاح");
            loadCashiers();
        } catch (error) {
            alert("خطأ في الحذف");
        }
    }
};

// ==========================================
// 9. شاشة البيع (بحث محلي، Debounce، منع Enter)
// ==========================================

const barcodeInput = document.getElementById('barcodeInput');
barcodeInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const code = barcodeInput.value.trim();
        if(code === "") return;

        if (barcodeDebounceTimers[code]) {
            return;
        }
        barcodeDebounceTimers[code] = true;
        setTimeout(() => {
            delete barcodeDebounceTimers[code];
        }, 4000);

        const normalizedSearch = normalizeText(code);
        const localProduct = productsList.find(p => 
            p.barcode === code || 
            (p.searchKey && p.searchKey.includes(normalizedSearch))
        );
        
        if (localProduct) {
            addToCart({...localProduct});
            barcodeInput.value = '';
            return;
        }

        try {
            let found = false;
            
            const qBarcode = query(collection(db, "products"), where("barcode", "==", code), limit(1));
            const barcodeSnap = await getDocs(qBarcode);
            
            if (!barcodeSnap.empty) {
                const productDoc = barcodeSnap.docs[0];
                let product = productDoc.data();
                product.id = productDoc.id;
                if (product.quantity !== -99999) {
                    addToCart(product);
                    barcodeInput.value = '';
                    found = true;
                }
            }
            
            if (!found) {
                const qName = query(collection(db, "products"), where("searchKey", "array-contains", normalizedSearch), limit(1));
                const nameSnap = await getDocs(qName);
                
                if (!nameSnap.empty) {
                    const productDoc = nameSnap.docs[0];
                    let product = productDoc.data();
                    product.id = productDoc.id;
                    if (product.quantity !== -99999) {
                        addToCart(product);
                        barcodeInput.value = '';
                        found = true;
                    }
                }
            }
            
            if (!found) {
                window.playSound('error');
                alert("المنتج غير موجود!");
            }
        } catch (error) {
            window.playSound('error');
            alert("حدث خطأ في البحث!");
        }
    }
});

// منع Enter في نماذج الإضافة ونقل التركيز
document.getElementById('prodBarcode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('prodName').focus();
    }
});

document.getElementById('restockBarcode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        lookupProductForRestock(e.target.value);
    }
});

// ==========================================
// 10. دوال السلة والبيع (مع تحديث الإحصائيات الفورية)
// ==========================================

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

async function updateStatsInRealTime(salesAmount, costAmount) {
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);
    
    try {
        const batch = writeBatch(db);
        
        const todayRef = doc(db, "stats", `day_${today}`);
        batch.set(todayRef, {
            totalSales: increment(salesAmount),
            totalCost: increment(costAmount),
            date: today
        }, { merge: true });
        
        const monthRef = doc(db, "stats", `month_${month}`);
        batch.set(monthRef, {
            totalSales: increment(salesAmount),
            totalCost: increment(costAmount),
            month: month
        }, { merge: true });
        
        await batch.commit();
    } catch (error) {
        console.error("Stats update error:", error);
    }
}

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
            batch.update(productRef, { quantity: increment(-item.cartQty) });
        }

        await batch.commit();

        currentShift.sales += totalSales;
        await updateStatsInRealTime(totalSales, totalCost);

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
// 11. القائمة السريعة (Quick Items) مع Base64
// ==========================================

async function loadQuickItems() {
    const grid = document.getElementById('quickItemsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    try {
        const snap = await getDocs(collection(db, "quickItems"));
        if (snap.empty) {
            return;
        }
        
        snap.forEach(doc => {
            const item = doc.data();
            if (item.active === false) return;
            
            const btn = document.createElement('button');
            btn.innerHTML = `${item.image ? `<img src="${item.image}" alt="${item.name}" style="max-width:40px; max-height:40px; display:block; margin:0 auto 5px auto;">` : ''} <span>${item.name}</span>`;
            btn.onclick = () => {
                const product = productsList.find(p => p.id === item.productId);
                if (product) addToCart({...product});
                else alert("المنتج لم يعد متوفرًا");
            };
            grid.appendChild(btn);
        });
    } catch (error) {
        console.error("خطأ في تحميل القائمة السريعة:", error);
    }
}

async function loadQuickItemsAdmin() {
    const list = document.getElementById('quickItemsAdminList');
    if (!list) return;
    list.innerHTML = 'جاري التحميل...';
    
    try {
        const snap = await getDocs(collection(db, "quickItems"));
        list.innerHTML = '';
        snap.forEach(doc => {
            const item = doc.data();
            if (item.active === false) return;
            list.innerHTML += `
                <div style="border:1px solid var(--border-color); padding:10px; border-radius:8px; text-align:center;">
                    <p><strong>${item.name}</strong></p>
                    ${item.image ? `<img src="${item.image}" style="max-width:80px; max-height:80px; display:block; margin:5px auto;">` : '<p style="color:#999;">لا توجد صورة</p>'}
                    <button onclick="window.uploadCustomImageForQuickItem('${doc.id}')" style="background:var(--primary-color); margin:5px;">📷 تغيير الصورة</button>
                    <button onclick="window.removeQuickItem('${doc.id}')" style="background:var(--danger-color); margin:5px;">حذف</button>
                </div>`;
        });
    } catch (error) {
        list.innerHTML = 'خطأ في التحميل';
    }
}

// ➕ دالة لرفع صورة مخصصة للقائمة السريعة (Base64)
window.uploadCustomImageForQuickItem = async function(docId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const base64 = await compressImage(file, 150, 150, 0.5);
            await updateDoc(doc(db, "quickItems", docId), { image: base64 });
            loadQuickItemsAdmin();
            alert("تم تحديث الصورة بنجاح");
        } catch (error) {
            alert("خطأ في رفع الصورة");
        }
    };
    
    input.click();
};

document.getElementById('addToQuickBtn').addEventListener('click', async () => {
    const searchInput = document.getElementById('quickSearchInput').value.trim();
    if (!searchInput) return alert("اكتب اسم المنتج للبحث");
    
    const normalizedSearch = normalizeText(searchInput);
    const product = productsList.find(p => 
        (p.searchKey && p.searchKey.includes(normalizedSearch))
    );
    if (!product) return alert("المنتج غير موجود");
    
    const snap = await getDocs(collection(db, "quickItems"));
    let activeCount = 0;
    snap.forEach(doc => {
        if (doc.data().active !== false) activeCount++;
    });
    if (activeCount >= 15) return alert("لا يمكن إضافة أكثر من 15 منتج");
    
    try {
        await addDoc(collection(db, "quickItems"), {
            productId: product.id,
            name: product.name,
            image: product.image || "", // ➕ استخدام صورة المنتج Base64
            active: true
        });
        document.getElementById('quickSearchInput').value = '';
        alert("تمت الإضافة للقائمة السريعة");
        loadQuickItemsAdmin();
    } catch (error) {
        alert("خطأ في الإضافة");
    }
});

window.removeQuickItem = async (docId) => {
    if (confirm("إزالة هذا المنتج من القائمة السريعة؟")) {
        await updateDoc(doc(db, "quickItems", docId), { active: false });
        loadQuickItemsAdmin();
    }
};

// ==========================================
// 12. المصروفات والإحصائيات
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

        document.getElementById('totalSalesStat').innerText = totalSales.toFixed(2) + " جنيه";
        document.getElementById('totalExpensesStat').innerText = totalExpenses.toFixed(2) + " جنيه";
        
        const netProfitEl = document.getElementById('netProfitStat');
        netProfitEl.innerText = netProfit.toFixed(2) + " جنيه";
        netProfitEl.style.color = netProfit >= 0 ? "var(--success-color)" : "var(--danger-color)";

    } catch (error) {
        console.error("Error loading stats: ", error);
    }
}

// ==========================================
// 13. القائمة الجانبية والكاميرا والصوتيات
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

// إظهار وإخفاء القائمة الفرعية للإدارة
navAdminBtn.addEventListener('click', () => {
    const subMenu = document.getElementById('adminSubMenu');
    if (adminSection.style.display === 'block') {
        subMenu.style.display = 'flex';
    }
});

// متابعة حالة القائمة الفرعية
const observer = new MutationObserver(() => {
    const subMenu = document.getElementById('adminSubMenu');
    if (adminSection.style.display === 'block') {
        subMenu.style.display = 'flex';
    } else {
        subMenu.style.display = 'none';
    }
});
observer.observe(adminSection, { attributes: true, attributeFilter: ['style'] });

const successSound = document.getElementById('successSound');
const errorSound = document.getElementById('errorSound');

window.playSound = function(type) {
    try {
        if (type === 'success') { successSound.currentTime = 0; successSound.play(); }
        else if (type === 'error') { errorSound.currentTime = 0; errorSound.play(); }
    } catch (error) {}
};

// ==========================================
// 14. إعداد الكاميرات الثلاثة (مع الإغلاق التلقائي)
// ==========================================

function setupCamera(buttonId, readerDivId, inputId, autoCloseCheckboxId, onScanCallback) {
    const btn = document.getElementById(buttonId);
    const readerDiv = document.getElementById(readerDivId);
    const input = document.getElementById(inputId);
    const autoCloseCheckbox = document.getElementById(autoCloseCheckboxId);
    let html5QrCode;
    let isCameraOpen = false;

    if (autoCloseCheckbox) {
        const saved = localStorage.getItem(`${autoCloseCheckboxId}_checked`);
        if (saved === 'true') autoCloseCheckbox.checked = true;
        autoCloseCheckbox.addEventListener('change', () => {
            localStorage.setItem(`${autoCloseCheckboxId}_checked`, autoCloseCheckbox.checked);
        });
    }

    btn.addEventListener('click', () => {
        if (isCameraOpen) {
            html5QrCode.stop().then(() => {
                readerDiv.style.display = 'none';
                isCameraOpen = false;
                btn.innerHTML = '📷';
            }).catch(err => console.log("خطأ في إغلاق الكاميرا"));
        } else {
            readerDiv.style.display = 'block';
            html5QrCode = new window.Html5Qrcode(readerDivId);
            
            html5QrCode.start(
                { facingMode: "environment" }, 
                { fps: 10, qrbox: { width: 250, height: 100 } },
                (decodedText) => {
                    input.value = decodedText;
                    
                    if (autoCloseCheckbox && autoCloseCheckbox.checked) {
                        html5QrCode.stop().then(() => {
                            readerDiv.style.display = 'none';
                            isCameraOpen = false;
                            btn.innerHTML = '📷';
                        });
                    }
                    
                    if (onScanCallback) onScanCallback(decodedText);
                },
                () => {}
            ).then(() => {
                isCameraOpen = true;
                btn.innerHTML = '❌ إغلاق الكاميرا';
            }).catch(() => {
                alert("برجاء السماح للمتصفح باستخدام الكاميرا!");
                readerDiv.style.display = 'none';
            });
        }
    });
}

// تهيئة الكاميرات
setupCamera('startCameraBtn', 'reader', 'barcodeInput', 'autoCloseCameraCheckbox', (text) => {
    barcodeInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter' }));
});

setupCamera('startProdCameraBtn', 'prodReader', 'prodBarcode', 'autoCloseProdCameraCheckbox', (text) => {
    document.getElementById('prodName').focus();
});

setupCamera('startRestockCameraBtn', 'restockReader', 'restockBarcode', 'autoCloseRestockCameraCheckbox', async (text) => {
    await lookupProductForRestock(text);
});
