/* ============ Supabase ============ */
var API = 'https://xmjmgfusfuyoifxbscur.supabase.co';
var KEY = 'sb_publishable_FpfJWcT59igaSPSue6nk0w_70Sac-wc';

/* ============ DOM ============ */
var $ = function(id) { return document.getElementById(id); };
var nameInput = $('nameInput');
var contentInput = $('contentInput');
var charCount = $('charCount');
var submitBtn = $('submitBtn');
var messagesList = $('messagesList');
var msgCount = $('msgCount');
var fileInput = $('fileInput');
var photoBtn = $('photoBtn');
var voiceBtn = $('voiceBtn');
var cancelBtn = $('cancelRecordBtn');
var uploadStatus = $('uploadStatus');
var previewArea = $('previewArea');
var previewContent = $('previewContent');
var previewClose = $('previewClose');

/* ============ 状态 ============ */
var myName = localStorage.getItem('gb_name') || '';
var pendingFile = null;
var recorder = null;
var chunks = [];
var recording = false;

/* ============ 名字 ============ */
if (myName) nameInput.value = myName;
nameInput.addEventListener('input', function() {
    localStorage.setItem('gb_name', nameInput.value.trim() || '');
});
contentInput.addEventListener('input', function() {
    charCount.textContent = contentInput.value.length + '/500';
});

/* ============ 图片 ============ */
photoBtn.addEventListener('click', function() { fileInput.click(); });
fileInput.addEventListener('change', function() {
    var f = fileInput.files[0];
    if (!f) return;
    setPreview(f, 'image');
    fileInput.value = '';
});

/* ============ 录音 ============ */
function stopRecord(discard) {
    if (recorder && recorder.state !== 'inactive') {
        if (discard) recorder.onstop = null;
        recorder.stop();
    }
    recording = false;
    voiceBtn.classList.remove('recording');
    voiceBtn.textContent = '🎤 录音';
    cancelBtn.classList.add('hidden');
    uploadStatus.textContent = '';
    if (discard) chunks = [];
}

cancelBtn.addEventListener('click', function() { stopRecord(true); });

voiceBtn.addEventListener('click', function() {
    if (recording) { stopRecord(false); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        uploadStatus.textContent = '浏览器不支持录音'; return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(s) {
        chunks = [];
        recorder = new MediaRecorder(s, { mimeType: 'audio/webm' });
        recorder.ondataavailable = function(e) {
            if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = function() {
            s.getTracks().forEach(function(t) { t.stop(); });
            if (chunks.length === 0) return;
            var blob = new Blob(chunks, { type: 'audio/webm' });
            if (blob.size < 200) {
                uploadStatus.textContent = '录音太短'; return;
            }
            setPreview(blob, 'audio');
            voiceBtn.classList.remove('recording');
            voiceBtn.textContent = '🎤 录音';
            cancelBtn.classList.add('hidden');
            recording = false;
        };
        recorder.start();
        recording = true;
        voiceBtn.classList.add('recording');
        voiceBtn.textContent = '⏹ 停止';
        cancelBtn.classList.remove('hidden');
        cancelBtn.style.display = '';
        uploadStatus.textContent = '录音中...';
    }).catch(function() {
        uploadStatus.textContent = '需要麦克风权限';
    });
});

/* ============ 预览 ============ */
function setPreview(blob, type) {
    pendingFile = { file: blob, type: type };
    var objUrl = window.URL.createObjectURL(blob);
    pendingFile.url = objUrl;
    previewArea.classList.remove('hidden');
    if (type === 'image') {
        previewContent.innerHTML = '<img src="' + objUrl + '" />';
    } else {
        previewContent.innerHTML = '<audio src="' + objUrl + '" controls></audio><div class="preview-name">🎤 (' + (blob.size/1024).toFixed(0) + 'KB)</div>';
    }
    uploadStatus.textContent = type === 'image' ? '📷 已选择图片' : '🎤 已录制';
}

previewClose.addEventListener('click', function() {
    pendingFile = null;
    previewArea.classList.add('hidden');
    previewContent.innerHTML = '';
    uploadStatus.textContent = '';
});

/* ============ 上传文件 ============ */
function uploadFile(file, cb) {
    var ext = file.type === 'audio/webm' ? '.webm' : '.jpg';
    var name = Date.now() + '_' + Math.random().toString(36).slice(2,6) + ext;
    fetch(API + '/storage/v1/object/guestbook/' + name, {
        method: 'POST',
        headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': file.type },
        body: file
    }).then(function(r) {
        if (!r.ok) throw new Error();
        cb(null, API + '/storage/v1/object/public/guestbook/' + name);
    }).catch(function() { cb('fail'); });
}

/* ============ 发布 ============ */
function postMsg() {
    var name = nameInput.value.trim() || '匿名';
    var text = contentInput.value.trim();
    if (!text && !pendingFile) { contentInput.focus(); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = '📨 发布中...';

    function save(fileUrl, fileType) {
        var data = { name: name, content: text || '' };
        if (fileUrl) { data.file_url = fileUrl; data.file_type = fileType; }
        fetch(API + '/rest/v1/messages', {
            method: 'POST',
            headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(data)
        }).then(function() {
            contentInput.value = '';
            charCount.textContent = '0/500';
            pendingFile = null;
            previewArea.classList.add('hidden');
            previewContent.innerHTML = '';
            uploadStatus.textContent = '';
            submitBtn.disabled = false;
            submitBtn.textContent = '📨 发布留言';
            knownIds = {};  // 清空缓存，重新加载
            loadMessages();
        }).catch(function() {
            submitBtn.disabled = false;
            submitBtn.textContent = '📨 发布留言';
        });
    }

    if (pendingFile) {
        uploadFile(pendingFile.file, function(err, url) {
            if (err) { uploadStatus.textContent = '上传失败'; save(null, null); }
            else { save(url, pendingFile.type); }
        });
    } else { save(null, null); }
}
submitBtn.addEventListener('click', postMsg);

/* ============ 加载留言（增量更新，不销毁已有元素） ============ */
var knownIds = {};  // 已展示的留言 id

function msgHtml(m) {
    var t = '';
    if (m.created_at) {
        var bj = new Date(new Date(m.created_at).getTime() + 8 * 3600000);
        t = bj.toISOString().slice(11, 19);
    }
    var fh = '';
    if (m.file_url && m.file_type === 'image') {
        fh = '<div class="msg-file"><img src="' + m.file_url + '" onclick="window.open(\'' + m.file_url + '\')" /></div>';
    }
    if (m.file_url && m.file_type === 'audio') {
        fh = '<div class="msg-file"><audio src="' + m.file_url + '" controls preload="none"></audio></div>';
    }
    return '<div class="msg-item" data-id="' + m.id + '"><div class="msg-header"><span class="msg-name">' +
        esc(m.name) + '</span><span class="msg-time">' + t + '</span></div>' +
        (m.content ? '<div class="msg-content">' + esc(m.content) + '</div>' : '') +
        fh + '</div>';
}

function loadMessages() {
    fetch(API + '/rest/v1/messages?order=created_at.desc&limit=200', {
        headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
    }).then(function(r) { return r.json(); }).then(function(data) {
        if (!data || !data.length) {
            if (Object.keys(knownIds).length === 0) {
                messagesList.innerHTML = '<div class="empty-state">还没有留言，来写第一条吧！</div>';
            }
            msgCount.textContent = Object.keys(knownIds).length + ' 条';
            return;
        }
        msgCount.textContent = data.length + ' 条';

        // 首次加载：全量渲染
        if (Object.keys(knownIds).length === 0) {
            messagesList.innerHTML = data.map(msgHtml).join('');
            data.forEach(function(m) { knownIds[m.id] = true; });
            return;
        }

        // 增量更新：只把新留言加到最前面
        var newItems = '';
        var newCount = 0;
        for (var i = 0; i < data.length; i++) {
            if (!knownIds[data[i].id]) {
                newItems += msgHtml(data[i]);
                knownIds[data[i].id] = true;
                newCount++;
            } else {
                break;  // 因为按时间倒序，遇到已知的说明后面的都已知
            }
        }
        if (newItems) {
            messagesList.insertAdjacentHTML('afterbegin', newItems);
        }
    }).catch(function(){});
}

function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

/* ============ 刷新按钮 ============ */
$('refreshBtn').addEventListener('click', function() {
    loadMessages();
});

/* ============ 启动 ============ */
loadMessages();
setInterval(loadMessages, 3000);
