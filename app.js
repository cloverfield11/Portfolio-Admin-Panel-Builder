const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const { resolveObjectURL } = require('buffer');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./my_database.db', (err) => {
    if (err) console.error(err.message);
    else console.log('Connected to the SQLite database.');
});

const upload = multer({
    limits: {
        fileSize: 10000000
    }
});

db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL)');

    const defaultAdmin = { username: 'admin', password: 'admin' };
    const insertDefaultAdmin = `INSERT INTO users (username, password) SELECT '${defaultAdmin.username}', '${defaultAdmin.password}' WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = '${defaultAdmin.username}')`;
    db.run(insertDefaultAdmin);
});

app.get('/', (req, res) => {
    db.all('SELECT * FROM states', [], (err, rows) => {
        if (err) {
            return console.error(err.message);
        }
        db.get('SELECT title, color1, color2, color3, color4, color5, color6, image, maintext, telegram, vk, mail, github FROM settings, design, image, about, socials WHERE settings.id = 1 AND design.id = 1 AND image.id = 1 AND about.id = 1 AND socials.id = 1', [], (err, row) => {
            if (err) {
                return console.error(err.message);
            }
            res.render('index', { title: row.title, color1: row.color1, color2: row.color2, color3: row.color3, color4: row.color4, color5: row.color5, color6: row.color6, image: row.image, maintext: row.maintext, telegram: row.telegram, vk: row.vk, mail: row.mail, github: row.github, states: rows });
        });
    });
});

app.post('/administrator/add_socials', (req, res) => {
    const { telegram, vk, mail, github } = req.body;

    db.run(`UPDATE socials SET telegram = ?, vk = ?, mail = ?, github = ? WHERE id = 1`, [telegram, vk, mail, github], function (err) {
        if (err) {
            return console.error(err.message);
        }
        res.redirect('/administrator');
    });
});

app.post('/administrator/edit_design', (req, res) => {
    const { color1, color2, color3 } = req.body;

    db.run(`UPDATE design SET color1 = ?, color2 = ?, color3 = ? WHERE id = 1`, [color1, color2, color3], function (err) {
        if (err) {
            return console.error(err.message);
        }
        res.redirect('/administrator');
    });
});

app.post('/administrator/add_state', upload.single('image'), (req, res) => {
    const { statext, link, statname, link2 } = req.body;

    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const base64Image = req.file.buffer.toString('base64');

    db.run(`INSERT INTO states (statext, image, link, statname, link2) VALUES (?, ?, ?, ?, ?)`, [statext, base64Image, link, statname, link2], function (err) {
        if (err) {
            return console.error(err.message);
        }
        res.redirect('/administrator');
    });
});


app.post('/administrator/edit_design_text', (req, res) => {
    const { color4, color5, color6 } = req.body;

    db.run(`UPDATE design SET color4 = ?, color5 = ?, color6 = ? WHERE id = 1`, [color4, color5, color6], function (err) {
        if (err) {
            return console.error(err.message);
        }
        res.redirect('/administrator');
    });
});

app.post('/administrator/edit_aboutme', (req, res) => {
    const { maintext } = req.body;

    db.run(`UPDATE about SET maintext = ? WHERE id = 1`, [maintext], function (err) {
        if (err) {
            return console.error(err.message);
        }
        res.redirect('/administrator');
    });
});

app.post('/administrator/edit_title', (req, res) => {
    const newTitle = req.body.title;

    const sql = 'UPDATE settings SET title = ? WHERE id = 1';
    db.run(sql, [newTitle], function (err) {
        if (err) {
            return console.error(err.message);
        }
        res.redirect('/administrator');
    });
});

app.get('/administrator/login', (req, res) => {
    res.render('login');
});

app.post('/administrator/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return console.error(err.message);
        if (!row) return res.send('User not found');

        if (password === row.password) {
            req.session.user = { id: row.id, username: row.username };
            res.redirect('/administrator');
        } else {
            res.send('Invalid password');
        }
    });
});

app.get('/administrator/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error(err);
        else res.redirect('/');
    });
});

app.post('/administrator/edit_logpass', (req, res) => {
    const { username, password } = req.body;
    const user = req.session.user;

    db.run(`UPDATE users SET username = ?, password = ? WHERE id = ?`, [
        username,
        password,
        user.id,
    ], (err) => {
        if (err) {
            return console.error(err.message);
        }
        req.session.user = { ...user, username, password };
        res.redirect('/administrator/login');
    });
});

app.post('/administrator/edit_design', (req, res) => {
    const { color1, color2, color3 } = req.body;

    db.run(`UPDATE design SET color1 = ?, color2 = ?, color3 = ?`, [color1, color2, color3], function (err) {
        if (err) {
            return console.error(err.message);
        }
        res.redirect('/administrator');
    });
});

app.get('/administrator', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/administrator/login');
    }

    db.get('SELECT title, color1, color2, color3, color4, color5, color6, maintext, telegram, vk, mail, github FROM settings, design, about, socials WHERE settings.id = 1 AND design.id = 1 AND about.id = 1 AND socials.id = 1', [], (err, row) => {
        if (err) {
            return console.error(err.message);
        }
        res.render('admin-panel', { title: row.title, color1: row.color1, color2: row.color2, color3: row.color3, color4: row.color4, color5: row.color5, color6: row.color6, maintext: row.maintext, telegram: row.telegram, vk: row.vk, mail: row.mail, github: row.github });
    });
});

app.post('/administrator/photo_aboutme', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const base64Image = req.file.buffer.toString('base64');

    db.run(`UPDATE image SET image = ? WHERE id = 1`, [base64Image], function (err) {
        if (err) {
            return console.error(err.message);
        }
        res.redirect('/administrator');
    });
});

app.get('/article/:id', (req, res) => {
    const articleId = req.params.id;

    // Query the database to get the article data based on the ID
    db.get('SELECT * FROM states WHERE id = ?', [articleId], (err, rows) => {
        if (err) {
            return console.error(err.message);
        }

        db.get('SELECT title, color1, color2, color3, color4, color5, color6, image, maintext FROM settings, design, image, about WHERE settings.id = 1 AND design.id = 1 AND image.id = 1 AND about.id = 1', [], (err, row) => {
            if (err) {
                return console.error(err.message);
            }
            res.render('article', { title: row.title, color1: row.color1, color2: row.color2, color3: row.color3, color4: row.color4, color5: row.color5, color6: row.color6, article: rows });
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));