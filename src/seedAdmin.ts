import "dotenv/config";
import { createAdminUser, getAdminById, updateAdminPassword } from "./services/adminService";
import { pool } from "./db";

async function seed() {
  const email = "pabitra@gmail.com";
  const password = "admin";
  const name = "Pabitra";

  try {
    console.log(`Checking if admin ${email} exists...`);
    // Check if exists
    const { rows } = await pool.query("SELECT id FROM admin_users WHERE email = $1", [email]);
    
    if (rows.length > 0) {
      console.log("Admin user already exists. Updating password...");
      await updateAdminPassword(rows[0].id, password);
      console.log("Admin password updated successfully!");
    } else {
      await createAdminUser(email, password, name, "admin");
      console.log("Admin user created successfully!");
    }
  } catch (error) {
    console.error("Failed to seed admin:", error);
  } finally {
    await pool.end();
  }
}

seed();
