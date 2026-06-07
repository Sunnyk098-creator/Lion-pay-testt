import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, update, runTransaction } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCVf5lRQ6t1gFbZeS9j2bf842NhoNrBX8M",
  authDomain: "lion-pay-a9557.firebaseapp.com",
  databaseURL: "https://lion-pay-a9557-default-rtdb.firebaseio.com",
  projectId: "lion-pay-a9557",
  storageBucket: "lion-pay-a9557.firebasestorage.app",
  messagingSenderId: "939533015657",
  appId: "1:939533015657:web:686447e1ba145e3c74a0f8"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const BOT_TOKEN = "7980852115:AAF_Tf6WL-mGm_IMkt4QP3Yu8LKZoc6JSUg";

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: "Only POST allowed" });

    try {
        let body = req.body || {};
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) {} }

        const action = body.action;
        const data = body.data || {};

        if (action === 'CLEAR_HISTORY') {
            const phone = data.phone;
            if(!phone) throw new Error("Missing user identification");
            const tSnap = await get(ref(db, "transactions"));
            let updates = {};
            if(tSnap.exists()) {
                tSnap.forEach(c => {
                    let t = c.val();
                    if(t.senderId === phone || t.receiverId === phone) updates[`transactions/${t.id}`] = null;
                });
            }
            if (Object.keys(updates).length > 0) await update(ref(db), updates);
            return res.json({ data: "Success" });
        }

        if (action === 'CHECK_USER') {
            let targetPhone = String(data.phone || '').trim();
            let normalizedInput = targetPhone.toLowerCase(); 
            const customSnap = await get(ref(db, `custom_ids/${normalizedInput}`));
            if (customSnap.exists()) targetPhone = customSnap.val(); 
            
            const snap = await get(ref(db, `users/${targetPhone}`));
            let userData = snap.exists() ? snap.val() : null;
            if (userData) userData.resolvedPhone = targetPhone; 
            else {
                const fallbackSnap = await get(ref(db, `users/${data.phone || ''}`));
                if (fallbackSnap.exists()) { userData = fallbackSnap.val(); userData.resolvedPhone = data.phone; }
            }
            return res.json({ data: userData });
        }

        if (action === 'LOGIN') {
            const snap = await get(ref(db, `users/${data.phone || ''}`));
            if (!snap.exists() || snap.val().password !== data.password) throw new Error("Invalid Phone or Password!");
            if (snap.val().isBanned) throw new Error("Account is Banned.");
            return res.json({ data: snap.val() });
        }

        if (action === 'REGISTER') {
            const snap = await get(ref(db, `users/${data.phone || ''}`));
            if (snap.exists()) throw new Error("Phone number already registered!");
            await set(ref(db, `users/${data.phone || ''}`), data.userObj);
            return res.json({ data: "Success" });
        }

        if (action === 'UPDATE_CREDS') {
            await update(ref(db, `users/${data.phone}`), { password: data.password, pin: data.pin });
            return res.json({ data: "Success" });
        }
        
        // NEW: Updates Name, TG ID, and Bot Alerts settings
        if (action === 'UPDATE_PROFILE') {
            const { phone, name, tgUserId, botAlerts } = data;
            const updates = {};
            if(name !== undefined) updates[`users/${phone}/name`] = name;
            if(tgUserId !== undefined) updates[`users/${phone}/tgUserId`] = tgUserId;
            if(botAlerts !== undefined) updates[`users/${phone}/botAlerts`] = botAlerts;
            await update(ref(db), updates);
            return res.json({ data: "Success" });
        }

        if (action === 'UPDATE_DP') {
            if(!data.phone || !data.dp) throw new Error("Missing details");
            await update(ref(db, `users/${data.phone}`), { dp: data.dp });
            return res.json({ data: "Success" });
        }
        
        if (action === 'SET_CUSTOM_ID') {
            const { phone, customId } = data;
            const normalizedCustomId = String(customId).toLowerCase().trim(); 
            const uSnap = await get(ref(db, `users/${phone}`));
            if (!uSnap.exists()) throw new Error("User not found!");
            const user = uSnap.val();
            let currentBal = Number(user.balance) || 0;
            const cost = user.premium ? 3 : 5;
            if (currentBal < cost) throw new Error("Insufficient Balance for Custom ID!");
            const cidSnap = await get(ref(db, `custom_ids/${normalizedCustomId}`));
            if (cidSnap.exists()) throw new Error("Custom ID already taken!");
            
            const updates = {};
            updates[`users/${phone}/balance`] = currentBal - cost;
            updates[`users/${phone}/customId`] = normalizedCustomId;
            updates[`custom_ids/${normalizedCustomId}`] = phone;
            await update(ref(db), updates);
            return res.json({ data: "Success" });
        }

        if (action === 'ACTIVATE_PREMIUM') {
            const { phone, duration, cost } = data;
            const uSnap = await get(ref(db, `users/${phone}`));
            if (!uSnap.exists()) throw new Error("User not found!");
            let currentBal = Number(uSnap.val().balance) || 0;
            if (currentBal < Number(cost)) throw new Error("Insufficient Balance!");
            
            const updates = {
                [`users/${phone}/balance`]: currentBal - Number(cost),
                [`users/${phone}/premium`]: true,
                [`users/${phone}/advancedUI`]: true,
                [`users/${phone}/premiumExpiry`]: Date.now() + Number(duration)
            };
            await update(ref(db), updates);
            return res.json({ data: "Success" });
        }
        
        if (action === 'UPDATE_PREFS') {
            const updates = {};
            if(data.theme !== undefined) updates[`users/${data.phone}/theme`] = data.theme;
            if(data.tag !== undefined) updates[`users/${data.phone}/tag`] = data.tag;
            if(data.advancedUI !== undefined) updates[`users/${data.phone}/advancedUI`] = data.advancedUI;
            if(data.accentColor !== undefined) updates[`users/${data.phone}/accentColor`] = data.accentColor;
            if(data.customUserTag !== undefined) updates[`users/${data.phone}/customUserTag`] = data.customUserTag;
            if(data.colorfulMode !== undefined) updates[`users/${data.phone}/colorfulMode`] = data.colorfulMode;
            await update(ref(db), updates);
            return res.json({ data: "Success" });
        }

        if (action === 'GENERATE_API') {
            await update(ref(db, `users/${data.phone}`), { apiKey: data.newKey }); 
            return res.json({ data: "Success" });
        }

        if (action === 'SET_CUSTOM_API') {
            const { phone, newKey } = data;
            if (!newKey || /\s/.test(newKey)) throw new Error("Invalid API Key!");
            const usersSnap = await get(ref(db, 'users'));
            let exists = false;
            if(usersSnap.exists()){ usersSnap.forEach(u => { if(u.val().apiKey === newKey && u.key !== phone) exists = true; }); }
            if(exists) throw new Error("API Key already taken!");
            await update(ref(db, `users/${phone}`), { apiKey: newKey });
            return res.json({ data: "Success" });
        }

        if (action === 'UPDATE_PRIVACY') {
            await update(ref(db), { [`users/${data.phone}/privacyMode`]: data.privacyMode });
            return res.json({ data: "Success" });
        }

        if (action === 'TOGGLE_TXN_VISIBILITY') {
            const { phone, txnId, isHidden } = data;
            await update(ref(db), { [`users/${phone}/hiddenTxns/${txnId}`]: isHidden ? true : null });
            return res.json({ data: "Success" });
        }

        if (action === 'SYNC') {
            if (!data.phone) throw new Error("Phone missing");
            const [uSnap, cSnap, tSnap, pSnap] = await Promise.all([ 
                get(ref(db, `users/${data.phone}`)), get(ref(db, "settings")), get(ref(db, "transactions")), get(ref(db, "posts"))
            ]);
            let userData = uSnap.val() || {};
            if (userData.premium && userData.premiumExpiry && Date.now() > Number(userData.premiumExpiry)) {
                userData.premium = false; await update(ref(db, `users/${data.phone}`), { premium: false });
            }
            let txns = [];
            if(tSnap.exists()) {
                tSnap.forEach(c => {
                    let t = c.val();
                    if(t.senderId === data.phone || t.receiverId === data.phone) txns.push(t);
                });
            }
            txns.sort((a, b) => b.timestamp - a.timestamp);
            let postsArr = []; if (pSnap.exists()) pSnap.forEach(p => { postsArr.push(p.val()); });
            return res.json({ data: { user: userData, settings: cSnap.val() || {}, txns: txns, posts: postsArr }});
        }

        if (action === 'EXECUTE_TXN') {
            let amt = Number(data.amount) || 0;
            const uSnap = await get(ref(db, `users/${data.sender}`));
            if (!uSnap.exists()) throw new Error("User not found!");
            let sBal = Number(uSnap.val().balance) || 0;
            let sKeeper = Number(uSnap.val().keeperBalance) || 0;
            
            if (['SEND', 'GHOST_SEND', 'WITHDRAW', 'KEEPER_LOCK'].includes(data.mode)) { if (sBal < amt) throw new Error("Insufficient Balance!"); }
            if (data.mode === 'KEEPER_WITHDRAW') { if (sKeeper < amt) throw new Error("Insufficient Keeper Balance!"); }

            const updates = {};
            if (data.mode === 'SEND' || data.mode === 'GHOST_SEND') {
                const rSnap = await get(ref(db, `users/${data.receiver}`));
                if (!rSnap.exists()) throw new Error("Receiver not found!");
                updates[`users/${data.sender}/balance`] = sBal - amt; 
                updates[`users/${data.receiver}/balance`] = Number(rSnap.val().balance) + amt;
            }
            else if (data.mode === 'WITHDRAW') updates[`users/${data.sender}/balance`] = sBal - amt;
            else if (data.mode === 'KEEPER_LOCK') { updates[`users/${data.sender}/balance`] = sBal - amt; updates[`users/${data.sender}/keeperBalance`] = sKeeper + amt; } 
            else if (data.mode === 'KEEPER_WITHDRAW') { updates[`users/${data.sender}/keeperBalance`] = sKeeper - amt; updates[`users/${data.sender}/balance`] = sBal + amt; } 
            else if (data.mode === 'DEPOSIT') updates[`users/${data.sender}/balance`] = sBal + amt;
            
            if(data.txn) updates[`transactions/${data.txn.id}`] = data.txn;
            await update(ref(db), updates); 
            return res.json({ data: "Success" });
        }

        if (action === 'BULK_PAY') {
            let total = Number(data.amount) * data.receivers.length;
            const uSnap = await get(ref(db, `users/${data.sender}`));
            if (!uSnap.exists() || Number(uSnap.val().balance) < total) throw new Error("Insufficient Balance!");
            
            const updates = { [`users/${data.sender}/balance`]: Number(uSnap.val().balance) - total };
            for(let num of data.receivers) {
                const rSnap = await get(ref(db, `users/${num}`));
                let rBal = rSnap.exists() ? Number(rSnap.val().balance) : 0;
                updates[`users/${num}/balance`] = rBal + Number(data.amount);
                let tId = 'TXN' + Date.now().toString(36).toUpperCase();
                updates[`transactions/${tId}`] = { id: tId, type: 'out', title: 'Bulk Send', amount: data.amount, status: 'Success', date: data.date, timestamp: Date.now(), icon: 'fa-users', color: 'purple', senderId: data.sender, receiverId: num };
            }
            await update(ref(db), updates);
            return res.json({ data: "Success" });
        }

        if (action === 'CREATE_LIFAFA') {
            const uSnap = await get(ref(db, `users/${data.phone}`));
            let total = Number(data.amount) * Number(data.totalUsers);
            if (!uSnap.exists() || Number(uSnap.val().balance) < total) throw new Error("Insufficient Balance!");
            
            let lifId = Math.random().toString(36).substring(2, 14).toUpperCase();
            await update(ref(db), { [`users/${data.phone}/balance`]: Number(uSnap.val().balance) - total, [`lifafas/${lifId}`]: { ...data, id: lifId, status: 'ACTIVE', claimedUsers: 0 }, [`transactions/${data.txn.id}`]: data.txn });
            return res.json({ data: lifId });
        }

        if (action === 'CLAIM_LIFAFA') {
            return res.json({ data: "Success" });
        }

        if (action === 'CREATE_GIFT') {
            let amt = Number(data.amount) || 0;
            const total = amt * data.users;
            const snap = await get(ref(db, `users/${data.phone}`));
            if (!snap.exists() || Number(snap.val().balance) < total) throw new Error("Insufficient Balance!");
            const updates = { [`users/${data.phone}/balance`]: Number(snap.val().balance) - total, [`giftcodes/${data.code}`]: { amountPerUser: amt, remainingUsers: data.users, totalUsers: data.users, createdBy: data.phone }, [`transactions/${data.txn.id}`]: data.txn };
            await update(ref(db), updates); return res.json({ data: "Success" });
        }

        if (action === 'CLAIM_GIFT') {
            let resultAmount = 0; const codeRef = ref(db, `giftcodes/${data.code}`); await update(ref(db), { dummy: null }); 
            const result = await runTransaction(codeRef, (currentData) => {
                if (currentData === null) return null; if (currentData.claimers && currentData.claimers[data.phone]) return; if (currentData.remainingUsers <= 0) return; 
                currentData.remainingUsers -= 1; if (!currentData.claimers) currentData.claimers = {}; currentData.claimers[data.phone] = true; return currentData;
            });
            if (!result.committed) throw new Error("Code invalid, expired, or already claimed.");
            
            resultAmount = Number(result.snapshot.val().amountPerUser);
            const uSnap = await get(ref(db, `users/${data.phone}`));
            
            const updates = { [`users/${data.phone}/balance`]: Number(uSnap.val().balance) + resultAmount, [`transactions/${data.txn.id}`]: { ...data.txn, amount: resultAmount } };
            if (result.snapshot.val().remainingUsers <= 0) updates[`giftcodes/${data.code}`] = null; 
            await update(ref(db), updates); return res.json({ data: resultAmount });
        }

        return res.status(400).json({ error: "Unknown Action" });
    } catch (e) { return res.status(500).json({ error: e.message }); }
}
