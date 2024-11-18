
const path = require("path");
const multer = require("multer");
const { Op } = require("sequelize"); 
const XLSX = require("xlsx"); 
const fs = require("fs");


const{ProductKind,Product}=require("../models/index.js");

const storage = multer.diskStorage({
  destination: "./src/assets/images/",
  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 },
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  },
}).single("image");

function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb("Error: Images Only!");
  }
}

exports.saveImg = (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      res.status(400).send({ message: err });
    } else {
      if (req.file == undefined) {
        res.status(400).send({ message: "No file selected!" });
      } else {
        const filepath = `${process.env.IMGPATH}${req.file.filename}`;
        res.send({ filepath });
      }
    }
  });
};


exports.getImg = (req, res) => {
  const imageName = req.params.imageName;
  const imagePath = path.join(__dirname, "../src/assets/images", imageName);

  res.sendFile(imagePath, (err) => {
    if (err) {
      res.status(404).send("Image not found");
    }
  });
};


exports.findProductsByProductKind = async (req, res) => {
  console.log("findProductsByProductKind route hit");

  try {
    const {
      id,
      productype,
      sku,
      colors,
      size,
      page = 1, 
      limit = 10, 
    } = req.query;

    let condition = {};

  
    if (id) condition.id = id;
    if (productype) condition.productype = { [Op.like]: `%${productype}%` };
    if (sku) condition.sku = { [Op.like]: `%${sku}%` };
    if (colors) condition.colors = { [Op.contains]: [colors] };
    if (size) condition.size = { [Op.contains]: [size] };

 
    const pagination = page && limit;

    const findOptions = {
      where: condition,
      order: [["id", "ASC"]],
      include: [
        {
          model: Product,
          as: "product_list",
          required: true,
        },
      ],
    };

    
    if (pagination) {
      const offset = (page - 1) * limit; 
      findOptions.offset = offset;
      findOptions.limit = parseInt(limit);
    }

    const { rows: productKinds} =
      await ProductKind.findAndCountAll(findOptions);

    const totalItems = await ProductKind.count({ where: condition });

    const formattedData = productKinds.map((productKind) => ({
      productKind: {
        id: productKind.id,
        productype: productKind.productype,
        sku: productKind.sku,
        colors: productKind.colors,
        size: productKind.size,
        description: productKind.description,
      },
      productArray: productKind.product_list.map((product) => ({
        no: product.no,
        product_name: product.product_name,
        sku: product.sku,
        description: product.description,
        color: product.color,
        size: product.size,
        imgurl: product.imgurl,
        quantity: product.quantity,
        product_t_id: product.product_t_id,
        price: product.price,
      })),
    }));

    const response = {
      data: formattedData,
      currentPage: pagination ? parseInt(page) : 1, 
    };

   
    if (pagination) {
      response.totalPages = Math.ceil(totalItems / limit);
    }

    res.status(200).json(response);
  } catch (err) {
    console.error(
      "Error fetching product types and related products:",
      err.message
    );
    res.status(500).send({
      message: err.message || "Some error occurred!",
    });
  }
};






exports.deleteProductKindandProduct= async (req, res) => {
  const { id } = req.params;

  try {
   
    await Product.destroy({
      where: { product_t_id: id },
    });

   
    const result = await ProductKind.destroy({
      where: { id },
    });

    if (result === 0) {
      return res.status(404).json({ message: "Product Kind not found" });
    }

    res
      .status(200)
      .json({
        message: "Product Kind and associated products deleted successfully",
      });
  } catch (err) {
    res.status(500).json({ message: err.message || "Some error occurred!" });
  }
};


exports.createOrUpdateProductWithVariants = async (req, res) => {
  const { id } = req.params;
  const { productData, generatedVariants, deleteVariantIds } = req.body;

  try {
    let mainProduct;

    if (id) {
      mainProduct = await ProductKind.findByPk(id);
    }

    if (mainProduct) {
      await mainProduct.update(productData);
    } else {
      mainProduct = await ProductKind.create(productData);
    }

    if (deleteVariantIds && deleteVariantIds.length > 0) {
      await Product.destroy({
        where: {
          no: deleteVariantIds,
        },
      });
    }

    const variantPromises = generatedVariants.map((variant) => {
      if (variant.no) {
        return Product.update(variant, {
          where: { no: variant.no },
        });
      } else {
        return Product.create({
          ...variant,
          product_t_id: mainProduct.id,
        });
      }
    });
    await Promise.all(variantPromises);

    res.status(200).json({
      message:
        "Product kind and associated variants created/updated successfully",
    });
  } catch (error) {
    console.error("Error creating/updating product and variants:", error);
    res.status(500).json({
      message: "An error occurred while creating/updating product and variants",
      error: error.message,
    });
  }
};





exports.exportProductData = async (req, res) => {
  try {
    
    const productKinds = await ProductKind.findAll({
      order: [["id", "ASC"]],
      include: [
        {
          model: Product,
          as: "product_list",
        },
      ],
    });

    
    const productKindData = productKinds.map((productKind) => ({
      id: productKind.id,
      productype: productKind.productype,
      sku: productKind.sku,
      colors: productKind.colors ? productKind.colors.join(", ") : "",
      size: productKind.size ? productKind.size.join(", ") : "",
      description: productKind.description,
    }));

    
    const combinedData = [];

    productKinds.forEach((productKind) => {
      productKind.product_list.forEach((product) => {
        combinedData.push({
          Id: productKind.id,
          productype: productKind.productype,
          productKindSku: productKind.sku,
          colors: productKind.colors ? productKind.colors.join(", ") : "",
          sizes: productKind.size ? productKind.size.join(", ") : "",
          Description: productKind.description,

          no: product.no,
          product_name: product.product_name,
          sku: product.sku,
          color: product.color,
          size: product.size,
          quantity: product.quantity,
          price: product.price,
          product_t_id: productKind.id,
        });
      });
    });

    const workbook = XLSX.utils.book_new();
    const combinedSheet = XLSX.utils.json_to_sheet(combinedData);
    XLSX.utils.book_append_sheet(workbook, combinedSheet, "ProductData");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=productData.xlsx"
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (error) {
    console.error("Error exporting product data:", error);
    res.status(500).send("Error exporting product data");
  }
};



exports.importProductData = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      console.error("File not received.");
      return res
        .status(400)
        .json({ status: "error", message: "No file uploaded." });
    }

    console.log("File received:", file.originalname);

    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const sheetNames = workbook.SheetNames;

    if (sheetNames.length === 0) {
      console.error("No sheets found in the workbook.");
      return res
        .status(400)
        .json({
          status: "error",
          message: "The Excel file contains no sheets.",
        });
    }

    const firstSheetName = sheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    const skippedRows = [];

    for (const row of data) {
      const {
        Id,
        productype,
        productKindSku,
        colors,
        sizes,
        Description,
        no,
        product_name,
        sku,
        color,
        size,
        quantity,
        price,
        product_t_id,
      } = row;

      if (!product_name || !sku || !quantity || !price) {
        console.error("Skipping invalid row:", row);
        skippedRows.push(row);
        continue;
      }

      let productKind;

      if (!product_t_id || product_t_id === "") {
        [productKind] = await ProductKind.findOrCreate({
          where: { sku: productKindSku },
          defaults: {
            productype,
            sku: productKindSku,
            colors: colors ? colors.split(",") : [],
            size: sizes ? sizes.split(",") : [],
            description: Description,
          },
        });
      } else {
        [productKind] = await ProductKind.findOrCreate({
          where: { id: product_t_id },
          defaults: {
            productype,
            sku: productKindSku,
            colors: colors ? colors.split(",") : [],
            size: sizes ? sizes.split(",") : [],
            description: Description,
          },
        });
      }

      await Product.create({
        no,
        product_name,
        sku,
        color,
        size,
        quantity,
        price,
        product_t_id: productKind.id,
      });
    }

    console.log("Product data imported successfully.");
    return res.status(200).json({
      status: "success",
      message: "Product data imported successfully.",
      skippedRows,
    });
  } catch (error) {
    console.error("Error importing product data:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error importing product data.",
      error: error.message,
    });
  }
};

