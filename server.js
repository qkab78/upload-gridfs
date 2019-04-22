const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const GridFsStream = require('gridfs-stream');
const methodOverride = require('method-override');

const app = express();


app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');

const mongoURI = '';
mongoose.Promise = global.Promise;
mongoose.set('debug', true);
const connection = mongoose.createConnection(mongoURI, {
    useNewUrlParser: true,
    useCreateIndex: true
});
let gfs;
connection.on('open', () => {
    // Init stream
    gfs = GridFsStream(connection.db, mongoose.mongo);
    gfs.collection('uploads');
})
// Create Multer Storage
const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString('hex') + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: 'uploads'
                };
                resolve(fileInfo);
            });
        });
    }
});
const upload = multer({
    storage
});

app.get('/', async (req, res) => {
    const files = await gfs.files.find().toArray();
    if (!files || files.length === 0) {
        return res.render('index', {
            files: false
        });
    } else {
        files.map(file => {
            if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
                file.isImage = true;
            } else {
                file.isImage = false;
            }
        });
        return res.render('index', {
            files
        });
    }

})

//Post a file
app.post('/upload', upload.single('file'), (req, res) => {
    return res.redirect('/')
});

//Get all files
app.get('/files', async (req, res) => {
    const files = await gfs.files.find().toArray();
    if (!files || files.length === 0) {
        return res.status(404).json({
            error: "No files found"
        })
    }
    return res.json(files);
});

//Get a file
app.get('/files/:filename', async (req, res) => {
    const file = await gfs.files.findOne({
        filename: req.params.filename
    });
    if (!file || file.length === 0) {
        return res.status(404).json({
            error: "No file found"
        })
    }
    return res.json(file);
});

//Get an image
app.get('/image/:filename', async (req, res) => {
    const file = await gfs.files.findOne({
        filename: req.params.filename
    });
    if (!file || file.length === 0) {
        return res.status(404).json({
            error: "No file found"
        })
    }
    //Check if image
    if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
        //Read output to browser
        const readstream = gfs.createReadStream(file.filename);
        readstream.pipe(res);
    } else {
        return res.status(404).json({
            error: "Not an image"
        })
    }
});

//Delete file
app.delete('/files/:id', async (req, res) => {
    const gridStore = await gfs.remove({
        _id: req.params.id,
        root: 'uploads'
    });
    if (!gridStore) {
        return res.status(404).json({
            err: 'Not found'
        })
    }
    return res.redirect('/');
});
const port = process.env.PORT || 5000;

app.listen(port, () => console.log(`Server listening on port ${port}`))