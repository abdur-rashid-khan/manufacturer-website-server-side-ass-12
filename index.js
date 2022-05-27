const express = require("express");
require('dotenv').config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.SECRET_KEY);
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
    const ordersCollection = client.db('max-shop').collection('orders');
    const reviewCollection = client.db('max-shop').collection('review');
    // const payCollection = client.db('max-shop').collection('pay');



    // admin verify 
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const requesterAccount = await usersCollection.findOne({ email: email });
      if (requesterAccount.role === 'admin') {
        next();
      }
      else {
        res.status(403).send({ message: 'forbidden' });
      }
    }



    app.get('/products', async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
    })

    // insert data
    app.post('/products', verifyToken, async (req, res) => {
      console.log(req.body);
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
    app.put('/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
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
    // delete user
    app.delete('/user/delete/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    })
    // admin 
    app.get('/admin/:email',  async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      const admin = user.role === 'admin';
      res.send({ admin: admin });
    })
    // single purchase get 
    app.get('/purchase/:id' , async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await productsCollection.findOne(filter);
      res.send(result);
    })
    // order 
    app.post('/order/:id', async (req, res) => {
      const id = req.params.id;
      const orderData = req.body;
      const result = await ordersCollection.insertOne(orderData);
      res.send(result);
    })
    // get order single data
    app.get('/order/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { productsId: id };
      const result = await ordersCollection.findOne(filter);
      res.send(result);
    })
    // payment
    app.post("/create-payment-intent", async (req, res) => {
      const data = req.body;
      // console.log(data.price);
      // const {price} = data;
      const price = data.price;
      // console.log(price)
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types:['card']
      });
      res.send({clientSecret: paymentIntent.client_secret});
    })
    // order 
    app.get('/my-order/:email' ,  async(req , res)=>{
      const email = req.params.email;
      const query = {email:email};
      // console.log(query);
      const result = await ordersCollection.find(query).toArray();
      res.send(result);
    })
    // Cancel order 
    app.delete('/cancel-order-item/:id', verifyToken , async(req , res ) =>{
      const id = req.params.id;
      const filter = {productsId:id};
      const result = await ordersCollection.deleteOne(filter);
      res.send(result);
    } )
    // add review
    app.post('/add-review',verifyToken , async(req , res)=>{
      const data = req.body;
      const result = await reviewCollection.insertOne(data);
      res.send(result);
    })
    // payment success
    app.put('/payment/:id', async(req , res)=>{
      const id = req.params.id;
      const payment = req.body;
      console.log(payment)
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set:{
          paid:true,
          transactionId:payment.paymentIntentId
        }
      }
      const result = await ordersCollection.updateOne(filter , updateDoc );
      res.send(result)
    })
    // get review 
    app.get('/review', async(req , res )=>{
      const result = await reviewCollection.find().toArray();
      res.send(result);
    })
    // manage-products
    app.get('/manage-products' , async(req , res )=>{
      const result = await productsCollection.find().toArray();
      res.send(result);
    })
    // delete products 
    app.delete('/manage-products/:id', verifyToken , async(req , res ) =>{
      const id = req.params.id;
      const filter = {_id:ObjectId(id)};
      const result = await productsCollection.deleteOne(filter);
      res.send(result);
    } )
    // manage-order
    app.get('/manage-order', async(req , res )=>{
      const result = await ordersCollection.find().toArray();
      res.send(result);
    })
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`localhost ${port}`)
})