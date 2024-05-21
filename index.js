const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

// midlewares
app.use(
  cors({
    origin: [
      "https://daily-extendure.web.app",
      "https://daily-extendure.firebaseapp.com",
      "http://localhost:5173"
    ],
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jq69c8i.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    const userCollection = client.db("DailyExtendure").collection("users");
    const productCollection = client
      .db("DailyExtendure")
      .collection("products");
    const purchaseCollection = client
      .db("DailyExtendure")
      .collection("purchases");
    const deletedCollection = client
      .db("DailyExtendure")
      .collection("deletedData");

    // middlewares
    const varifyToken = (req, res, next) => {
      if (!req.headers?.authorization) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }

      const token = req.headers?.authorization.split(" ")[1];

      jwt.verify(token, process.env.JWT_SECRET_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // jwt api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET_TOKEN, {
        expiresIn: "10h",
      });
      res.send({ token });
    });

    // users api
    app.get("/userInfo", varifyToken, async (req, res) => {
      const email = req.query?.email;
      // console.log(email);
      if (email) {
        const query = { "personalInfo.email": email };
        const user = await userCollection.findOne(query);

        res.send(user);
      }
    });

    app.post("/users", async (req, res) => {
      const userInfo = req.body;

      const result = await userCollection.insertOne(userInfo);
      res.send(result);
    });

    // products api
    app.get("/products", varifyToken, async (req, res) => {
      const email = req.query?.email;
      if (email) {
        const filter = { seller: email };
        const result = await productCollection.find(filter).toArray();
        return res.send(result);
      }
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    app.post("/products", varifyToken, async (req, res) => {
      const productInfo = req.body;
      const { sku } = productInfo;
      // console.log(productInfo);

      const existingProduct = await productCollection.findOne({ sku });
      if (existingProduct) {
        return res.status(400).send({ message: "SKU must be unique" });
      }

      const result = await productCollection.insertOne(productInfo);
      res.send(result);
    });

    app.patch("/products/:id", varifyToken, async (req, res) => {
      const updatedInfo = req.body;
      // console.log(updatedInfo);
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const {
        productName,
        photoURL,
        sku,
        quantity,
        price,
        description,
        seller,
        status,
      } = updatedInfo;

      const updatedDoc = {
        $set: {
          productName,
          photoURL,
          sku,
          quantity,
          price,
          description,
          seller,
          status,
        },
      };

      if (status !== "sold") {
        const existingProduct = await productCollection.findOne({ sku });
        if (existingProduct) {
          return res.status(400).send({ message: "SKU must be unique" });
        }
      }

      const result = await productCollection.updateOne(filter, updatedDoc);
      // console.log(result);
      res.send(result);
    });

    app.delete("/products/:id", varifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const product = await productCollection.findOne(filter);
      const recycleBin = await deletedCollection.insertOne(product);
      const result = await productCollection.deleteOne(filter);
      res.send(result);
    });

    // purchases api
    app.get("/purchase", varifyToken, async (req, res) => {
      const email = req?.query?.email;

      if (email) {
        const query = { buyer: email };
        const allPurchases = await purchaseCollection.find(query).toArray();
        return res.send(allPurchases);
      }
    });

    app.post("/purchase", varifyToken, async (req, res) => {
      const purchaseInfo = req.body;
      const result = await purchaseCollection.insertOne(purchaseInfo);
      res.send(result);
    });

    app.delete("/purchase/:id", varifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await purchaseCollection.deleteOne(query);
      res.send(result);
    });

    // customar info
    app.get("/statistics", varifyToken, async (req, res) => {
      const email = req.query?.email;

      const query = { seller: email };
      const customers = await purchaseCollection.find(query).toArray();
      const customersInfo = customers?.map((item) => ({
        buyer: item?.buyer,
        buyerName: item?.buyerName,
        buyerImage: item?.buyerImage,
      }));
      const totalSell = await purchaseCollection.find(query).count();
      const availableProducts = await productCollection.find(query).count();
      const prices = customers?.map((item) => parseFloat(item?.price));
      const totalAmount =
        prices.length > 0
          ? prices?.reduce((total, current) => total + current)
          : 0;

      // console.log(customers);
      res.send({ customersInfo, totalSell, totalAmount, availableProducts });
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log("listening on port", port);
});
