const pool = require("../config/configwithquery.js");
const XLSX = require("xlsx"); 
const querstockcontroller = {
  
  findProductsByProductKind:async (req, res) => {
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
  
      
      const baseQuery = `
        SELECT pk.*, 
               json_agg(p.*) AS product_list
        FROM productkinds pk
        LEFT JOIN product_list p ON pk.id = p.product_t_id
      `;
      
      let whereClauses = [];
      let queryParams = [];
      let paramIndex = 1;
  
      if (id) {
        whereClauses.push(`pk.id = $${paramIndex++}`);
        queryParams.push(id);
      }
      if (productype) {
        whereClauses.push(`pk.productype ILIKE $${paramIndex++}`);
        queryParams.push(`%${productype}%`);
      }
      if (sku) {
        whereClauses.push(`pk.sku ILIKE $${paramIndex++}`);
        queryParams.push(`%${sku}%`);
      }
      if (colors) {
        whereClauses.push(`$${paramIndex++} = ANY(pk.colors)`);
        queryParams.push(colors);
      }
      if (size) {
        whereClauses.push(`$${paramIndex++} = ANY(pk.size)`);
        queryParams.push(size);
      }
  
      const whereClause = whereClauses.length
        ? `WHERE ${whereClauses.join(" AND ")}`
        : "";
  
      const pagination = page && limit;
      const offset = pagination ? (page - 1) * limit : 0;
  
      
      const finalQuery = `
        ${baseQuery}
        ${whereClause}
        GROUP BY pk.id
        ORDER BY pk.id ASC
        ${pagination ? `LIMIT $${paramIndex++} OFFSET $${paramIndex}` : ""}
      `;
  
      if (pagination) {
        queryParams.push(parseInt(limit), offset);
      }
  
      
      const { rows: productKinds } = await pool.query(finalQuery, queryParams);
  
      
      const countQuery = `
        SELECT COUNT(*) AS total
        FROM productkinds pk
        ${whereClause}
      `;
      const { rows: countResult } = await pool.query(countQuery, queryParams.slice(0, paramIndex - 2));
      const totalItems = parseInt(countResult[0].total);
  
      
      const formattedData = productKinds.map((productKind) => ({
        productKind: {
          id: productKind.id,
          productype: productKind.productype,
          sku: productKind.sku,
          colors: productKind.colors,
          size: productKind.size,
          description: productKind.description,
        },
        productArray: productKind.product_list || [],
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
  },
  


  deleteProductKindAndProduct : async (req, res) => {
    const { id } = req.params;
  
    try {
      const client = await pool.connect();
  
      try {
      
        const deleteProductsQuery = `
          DELETE FROM product_list
          WHERE product_t_id = $1;
        `;
        await client.query(deleteProductsQuery, [id]);
  
        
        const deleteProductKindQuery = `
          DELETE FROM productkinds
          WHERE id = $1
          RETURNING *;
        `;
        const result = await client.query(deleteProductKindQuery, [id]);
  
        if (result.rowCount === 0) {
          return res.status(404).json({ message: "Product Kind not found" });
        }
  
        res.status(200).json({
          message: "Product Kind and associated products deleted successfully",
        });
      } finally {
        client.release(); 
      }
    } catch (err) {
      console.error("Error:", err.message || "Some error occurred!");
      res.status(500).json({ message: err.message || "Some error occurred!" });
    }
  },
  
  createOrUpdateProductWithVariants: async (req, res) => {
    const { id } = req.params;
    const { productData, generatedVariants, deleteVariantIds } = req.body;
  
    const client = await pool.connect();
  
    try {
      await client.query("BEGIN"); 
  
      let mainProductId;
  
      if (id && id !==0 && id !== '0') {
      
        const updateProductQuery = `
          UPDATE productkinds
          SET productype = $1, description = $2, colors = $3, size = $4, sku = $5
          WHERE id = $6
          RETURNING id;
        `;
        const updateResult = await client.query(updateProductQuery, [
          productData.productype,
          productData.description,
          productData.colors,
          productData.size,
          productData.sku,
          id,
        ]);
        mainProductId = updateResult.rows[0]?.id;
      }
  
      if (!mainProductId) {
       
        const insertProductQuery = `
          INSERT INTO productkinds (productype, description, colors, size, sku)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id;
        `;
        const insertResult = await client.query(insertProductQuery, [
          productData.productype,
          productData.description,
          productData.colors,
          productData.size,
          productData.sku,
        ]);
        mainProductId = insertResult.rows[0].id;
      }
  
      
      if (deleteVariantIds && deleteVariantIds.length > 0) {
        const deleteQuery = `
          DELETE FROM product_list
          WHERE no = ANY($1);
        `;
        await client.query(deleteQuery, [deleteVariantIds]);
      }
  
      
      for (const variant of generatedVariants) {
        if (variant.no) {
        
          const updateVariantQuery = `
            UPDATE product_list
            SET product_name = $1, sku = $2, color = $3, size = $4, imgurl = $5, quantity = $6, price = $7
            WHERE no = $8;
          `;
          await client.query(updateVariantQuery, [
            variant.product_name,
            variant.sku,
            variant.color,
            variant.size,
            variant.imgurl,
            variant.quantity,
            variant.price,
            variant.no,
          ]);
        } else {
         
          const insertVariantQuery = `
            INSERT INTO product_list (product_name, sku, color, size, imgurl, quantity, price, product_t_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
          `;
          await client.query(insertVariantQuery, [
            variant.product_name,
            variant.sku,
            variant.color,
            variant.size,
            variant.imgurl,
            variant.quantity,
            variant.price,
            mainProductId,
          ]);
        }
      }
  
      await client.query("COMMIT"); 
  
      res.status(200).json({
        message:
          "Product kind and associated variants created/updated successfully",
      });
    } catch (error) {
      await client.query("ROLLBACK"); 
      console.error("Error creating/updating product and variants:", error);
      res.status(500).json({
        message: "An error occurred while creating/updating product and variants",
        error: error.message,
      });
    } finally {
      client.release(); 
    }
  },

  exportProductData: async (req, res) => {
    try {
      const client = await pool.connect();
  
      const productKindsQuery = `
        SELECT 
          pl.product_name, 
          pl.sku AS product_sku, 
          pl.color, 
          pl.size, 
          pl.quantity, 
          pl.price, 
          pk.productype, 
          pk.sku AS productkind_sku, 
          ARRAY_TO_STRING(pk.colors, ',') AS productkind_colors, 
          ARRAY_TO_STRING(pk.size, ',') AS productkind_sizes, 
          pk.description
        FROM 
          product_list pl
        LEFT JOIN 
          productkinds pk
        ON 
          pl.product_t_id = pk.id
        ORDER BY 
          pl.product_t_id ASC;
      `;
  
      const result = await client.query(productKindsQuery);
  
      const combinedData = result.rows.map(row => ({
        ProductName: row.product_name,
        SKU: row.product_sku,
        Color: row.color,
        Size: row.size,
        Quantity: row.quantity,
        Price: row.price,
        ProductType: row.productype,
        ProductKindSKU: row.productkind_sku,
        Colors: row.productkind_colors || "",
        Sizes: row.productkind_sizes || "",
        Description: row.description || "",
      }));
  
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
      client.release();
    } catch (error) {
      console.error("Error exporting product data:", error);
      res.status(500).send("Error exporting product data");
    }
  },


  importProductData : async (req, res) => {
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
          .json({ status: "error", message: "The Excel file contains no sheets." });
      }
  
      const firstSheetName = sheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const data = XLSX.utils.sheet_to_json(sheet);
  
      const skippedRows = [];
      const client = await pool.connect();
  
      try {
        for (const row of data) {
          const {
            ProductName,
            SKU,
            Color,
            Size,
            Quantity,
            Price,
            ProductType,
            ProductKindSKU,
            Colors,
            Sizes,
            Description,
          } = row;
  
         
          if (!ProductName || !SKU || !Quantity || !Price) {
            console.error("Skipping invalid row:", row);
            skippedRows.push(row);
            continue;
          }
  
          let productKindId;
  
          
          const productKindQuery = `
            INSERT INTO productkinds (productype, sku, colors, size, description)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (sku) DO UPDATE 
            SET colors = EXCLUDED.colors, 
                size = EXCLUDED.size, 
                description = EXCLUDED.description
            RETURNING id;
          `;
  
          const productKindResult = await client.query(productKindQuery, [
            ProductType,
            ProductKindSKU,
            Colors ? Colors.split(",") : [],
            Sizes ? Sizes.split(",") : [],
            Description,
          ]);
  
          productKindId = productKindResult.rows[0].id;
  
          
          const productQuery = `
            INSERT INTO product_list (product_name, sku, color, size, quantity, price, product_t_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (sku) DO UPDATE 
            SET color = EXCLUDED.color, 
                size = EXCLUDED.size, 
                quantity = EXCLUDED.quantity, 
                price = EXCLUDED.price;
          `;
  
          await client.query(productQuery, [
            ProductName,
            SKU,
            Color,
            Size,
            Quantity,
            Price,
            productKindId,
          ]);
        }
  
        console.log("Product data imported successfully.");
        return res.status(200).json({
          status: "success",
          message: "Product data imported successfully.",
          skippedRows,
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error importing product data:", error.message);
      return res.status(500).json({
        status: "error",
        message: "Error importing product data.",
        error: error.message,
      });
    }
  }
  
};

module.exports = querstockcontroller;
