const multer = require("multer");
const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
  },
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(xlsx|xls)$/)) {
      return cb(new Error("Please upload a valid Excel (.xlsx or .xls) file"));
    }
    cb(null, true);
  },
});

module.exports = (app) => {
  const productController = require("../controllers/stock.controller.js");

  const router = require("express").Router();

  
  router.get(
    "/product-types-with-products",
    productController.findProductsByProductKind
  );
 
  router.get("/productdata/export", productController.exportProductData);
  router.post("/imageUpload", productController.saveImg);
  router.get("/assets/images/:imageName", productController.getImg);
  router.post(
    "/productdata/import",
    upload.single("file"),
    productController.importProductData
  );
  router.delete("/allproductbypK/:id",productController.deleteProductKindandProduct);
  router.put(
   "/updateWithVariants/:id",
   productController.createOrUpdateProductWithVariants
 );
  app.use("/api/products", router);
};
