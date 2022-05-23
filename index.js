const express = require("express");
require('dotenv').config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require('jsonwebtoken');
const res = require("express/lib/response");
const { query } = require("express");
const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());




// verify token
const verifyToken = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).send({ messages: 'UnAuthorization' });
  }
  const token = auth.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).send({ messages: 'Forbidden access' })
    }
    req.decoded = decoded;
    next()
  })
}



app.get('/', (req, res) => {
  res.send('DB connected')
})
// Replace the uri string with your MongoDB deployment's connection string.
const uri =
  `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lqf9l.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
async function run() {
  try {
    await client.connect();
    const productsCollection = client.db('max-shop').collection('products');
    const usersCollection = client.db('max-shop').collection('users');

    app.get('/products', async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
    })

    // insert data
    app.post('/products', verifyToken, async (req, res) => {
      // console.log(req.body);
      const insertData = req.body;
      const result = await productsCollection.insertOne(insertData);
      res.send(result);
    })
    //put user data 
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const option = { upsert: true };
      const updateDos = {
        $set: user,
      }
      const result = await usersCollection.updateOne(filter, updateDos, option);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '24h' });
      res.send({ result, token });

    })
    // user 
    app.get('/user', verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })
    //made admin
    app.put('/admin/:email', verifyToken , async (req, res) => {
      const email = req.params.email;
      console.log(email)
      const requester = req.decoded.email;
      const requesterAccount = await usersCollection.findOne({ email: requester })
      if (requesterAccount.role === 'admin') {
        const filter = { email: email };
        
        const updateDos = {
          $set: { role: 'admin' },
        }
        const result = await usersCollection.updateOne(filter, updateDos);
        res.send(result);
      } else {
        res.status(403).send({ messages: 'forbidden' });
      }
    })
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`localhost ${port}`)
})