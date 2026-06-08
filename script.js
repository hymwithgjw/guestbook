/* ============ Supabase ============ */
var URL = 'https://xmjmgfusfuyoifxbscur.supabase.co';
var KEY = 'sb_publishable_FpfJWcT59igaSPSue6nk0w_70Sac-wc';

/* ============ DOM ============ */
var nameInput = document.getElementById('nameInput');
var contentInput = document.getElementById('contentInput');
var charCount = document.getElementById('charCount');
var submitBtn = document.getElementById('submitBtn');
var messagesList = document.getElementById('messagesList');
var msgCount = document.getElementById('msgCount');
var fileInput = document.getElementById('fileInput');
var photoBtn = document.getElementById('photoBtn');
var voiceBtn = document.getElementById('voiceBtn');
var cancelRecordBtn = document.getElementById('cancelRecordBtn');
var uploadStatus = document.getElementById('uploadStatus');
var previewArea = document.getElementById('previewArea');
var previewContent = document.getElementById('previewContent');
var previewClose = document.getElementById('previewClose');

/* ============ 状态 ============ */
var myName = localStorage.getItem('gb_name') || '';
var pendingFile = null;   // { file: Blob, type: 'image'|'audio', url: string }
var mediaRecorder = null;
var audioChunks = [];
var isRecording = false;

/* ============ 名字 ============ */
if (myName) nameInput.value = myName;
nameInput.addEventListener('input', function() {
    localStorage.setItem('gb_name', nameInput.value.trim() || '');
});

contentInput.addEventListener('input', function() {
    charCount.textContent = contentInput.value.length + '/500';
});

/* ============ 图片上传 ============ */
photoBtn.addEventListener('click', function() {
    fileInput.click();
});

fileInput.addEventListener('change', function() {
    var file = fileInput.files[0];
    if (!file) return;
    setPendingFile(file, 'image');
    fileInput.value = '';
});

/* ============ 录音 ============ */
function cancelRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.onstop = null;
        mediaRecorder.stop();
    }
    audioChunks = [];
    isRecording = false;
    voiceBtn.classList.remove('recording');
    voiceBtn.textContent = '🎤 录音';
    cancelRecordBtn.classList.add('hidden');
    uploadStatus.textContent = '';
}

cancelRecordBtn.addEventListener('click', cancelRecording);

voiceBtn.addEventListener('click', function() {
    if (isRecording) {
        // 停止录音 → 进入预览
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        return;
    }
    // 开始录音
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        uploadStatus.textContent = '浏览器不支持录音';
        return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorder.ondataavailable = function(e) {
            if (e.data.size > 0) audioChunks.push(e.data);
        };
        mediaRecorder.onstop = function() {
            stream.getTracks().forEach(function(t) { t.stop(); });
            var blob = new Blob(audioChunks, { type: 'audio/webm' });
            if (blob.size < 100) {
                uploadStatus.textContent = '录音太短或未录制';
                voiceBtn.classList.remove('recording');
                voiceBtn.textContent = '🎤 录音';
                isRecording = false;
                return;
            }
            setPendingFile(blob, 'audio');
            voiceBtn.classList.remove('recording');
            voiceBtn.textContent = '🎤 录音';
            cancelRecordBtn.classList.add('hidden');
            isRecording = false;
        };
        mediaRecorder.start();
        isRecording = true;
        voiceBtn.classList.add('recording');
        voiceBtn.textContent = '⏹ 停止';
        cancelRecordBtn.classList.remove('hidden');
        uploadStatus.textContent = '录音中...';
    }).catch(function() {
        uploadStatus.textContent = '需要麦克风权限';
    });
});

/* ============ 预览 ============ */
function setPendingFile(blob, type) {
    pendingFile = { file: blob, type: type };
    var url = URL.createObjectURL(blob);
    pendingFile.url = url;
    previewArea.classList.remove('hidden');
    if (type === 'image') {
        previewContent.innerHTML = '<img src="' + url + '" />';
    } else {
        previewContent.innerHTML = '<audio src="' + url + '" controls></audio><div class="preview-name">🎤 录音 (' + (blob.size / 1024).toFixed(0) + 'KB)</div>';
    }
    uploadStatus.textContent = type === 'image' ? '📷 已选择图片' : '🎤 已录制音频';
}

previewClose.addEventListener('click', function() {
    pendingFile = null;
    previewArea.classList.add('hidden');
    previewContent.innerHTML = '';
    uploadStatus.textContent = '';
});

/* ============ 上传到 Supabase Storage ============ */
function uploadFile(file, callback) {
    var ext = file.type === 'audio/webm' ? '.webm' : '.jpg';
    var fileName = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext;

    fetch(URL + '/storage/v1/object/guestbook/' + fileName, {
        method: 'POST',
        headers: {
            'apikey': KEY,
            'Authorization': 'Bearer ' + KEY,
            'Content-Type': file.type
        },
        body: file
    })
    .then(function(r) {
        if (!r.ok) throw new Error('upload fail');
        var publicUrl = URL + '/storage/v1/object/public/guestbook/' + fileName;
        callback(null, publicUrl);
    })
    .catch(function(e) {
        callback(e);
    });
}

/* ============ 发布 ============ */
function postMessage() {
    var name = nameInput.value.trim() || '匿名';
    var content = contentInput.value.trim();
    if (!content && !pendingFile) { contentInput.focus(); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = '📨 发布中...';

    function doPost(fileUrl, fileType) {
        var data = { name: name, content: content || '' };
        if (fileUrl) { data.file_url = fileUrl; data.file_type = fileType; }

        fetch(URL + '/rest/v1/messages', {
            method: 'POST',
            headers: {
                'apikey': KEY,
                'Authorization': 'Bearer ' + KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(data)
        })
        .then(function() {
            contentInput.value = '';
            charCount.textContent = '0/500';
            pendingFile = null;
            previewArea.classList.add('hidden');
            previewContent.innerHTML = '';
            uploadStatus.textContent = '';
            submitBtn.disabled = false;
            submitBtn.textContent = '📨 发布留言';
            loadMessages();
        })
        .catch(function() {
            submitBtn.disabled = false;
            submitBtn.textContent = '📨 发布留言';
        });
    }

    if (pendingFile) {
        uploadFile(pendingFile.file, function(err, fileUrl) {
            if (err) {
                uploadStatus.textContent = '文件上传失败，仅发布文字';
                doPost(null, null);
            } else {
                doPost(fileUrl, pendingFile.type);
            }
        });
    } else {
        doPost(null, null);
    }
}

submitBtn.addEventListener('click', postMessage);

/* ============ 加载留言 ============ */
function loadMessages() {
    fetch(URL + '/rest/v1/messages?order=created_at.desc&limit=200', {
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
            var time = '';
            if (m.created_at) {
                var bj = new Date(new Date(m.created_at).getTime() + 8 * 3600000);
                time = bj.toISOString().slice(11, 19);
            }
            var fileHtml = '';
            if (m.file_url) {
                if (m.file_type === 'image') {
                    fileHtml = '<div class="msg-file"><img src="' + m.file_url + '" onclick="window.open(\'' + m.file_url + '\')" /></div>';
                } else if (m.file_type === 'audio') {
                    fileHtml = '<div class="msg-file"><audio src="' + m.file_url + '" controls></audio></div>';
                }
            }
            return '<div class="msg-item">' +
                '<div class="msg-header">' +
                    '<span class="msg-name">' + esc(m.name) + '</span>' +
                    '<span class="msg-time">' + time + '</span>' +
                '</div>' +
                (m.content ? '<div class="msg-content">' + esc(m.content) + '</div>' : '') +
                fileHtml +
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
