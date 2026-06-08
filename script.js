/* ============ Supabase ============ */
var URL = 'https://xmjmgfusfuyoifxbscur.supabase.co';
var KEY = 'sb_publishable_FpfJWcT59igaSPSue6nk0w_70Sac-wc';
var TABLE = 'messages';

function api(method, body, callback) {
    var opts = {
        method: method,
        headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    fetch(URL + '/rest/v1/' + TABLE + '?order=created_at.desc&limit=200', opts)
        .then(function(r) { return r.json(); })
        .then(function(data) { if (callback) callback(data); })
        .catch(function(){});
}

/* ============ DOM ============ */
var nameInput = document.getElementById('nameInput');
var contentInput = document.getElementById('contentInput');
var charCount = document.getElementById('charCount');
var submitBtn = document.getElementById('submitBtn');
var messagesList = document.getElementById('messagesList');
var msgCount = document.getElementById('msgCount');

/* ============ 状态 ============ */
var myName = localStorage.getItem('gb_name') || '';

/* ============ 名字 ============ */
if (myName) nameInput.value = myName;
nameInput.addEventListener('input', function() {
    localStorage.setItem('gb_name', nameInput.value.trim() || '');
});

contentInput.addEventListener('input', function() {
    var len = contentInput.value.length;
    charCount.textContent = len + '/500';
});

/* ============ 发布 ============ */
function postMessage() {
    var name = nameInput.value.trim() || '匿名';
    var content = contentInput.value.trim();
    if (!content) { contentInput.focus(); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = '📨 发布中...';

    var data = { name: name, content: content };
    fetch(URL + '/rest/v1/' + TABLE, {
        method: 'POST',
        headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(data)
    })
    .then(function() {
        contentInput.value = '';
        charCount.textContent = '0/500';
        submitBtn.disabled = false;
        submitBtn.textContent = '📨 发布留言';
        loadMessages();
    })
    .catch(function() {
        submitBtn.disabled = false;
        submitBtn.textContent = '📨 发布留言';
    });
}

submitBtn.addEventListener('click', postMessage);

/* ============ 加载留言 ============ */
function loadMessages() {
    fetch(URL + '/rest/v1/' + TABLE + '?order=created_at.desc&limit=200', {
        headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (!data || !data.length) {
            messagesList.innerHTML = '<div class="empty-state">还没有留言，来写第一条吧！</div>';
            msgCount.textContent = '0 条';
            return;
        }
        msgCount.textContent = data.length + ' 条';
        messagesList.innerHTML = data.map(function(m) {
            var time = m.created_at ? m.created_at.slice(11, 16) : '';
            return '<div class="msg-item">' +
                '<div class="msg-header">' +
                    '<span class="msg-name">' + esc(m.name) + '</span>' +
                    '<span class="msg-time">' + time + '</span>' +
                '</div>' +
                '<div class="msg-content">' + esc(m.content) + '</div>' +
            '</div>';
        }).join('');
    })
    .catch(function(){});
}

function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

/* ============ 初始化 + 自动刷新 ============ */
loadMessages();
setInterval(loadMessages, 3000);
