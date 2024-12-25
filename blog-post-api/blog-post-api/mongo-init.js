db = db.getSiblingDB("blog-post-dev");

db.createUser({
  user: "api-dev",
  pwd: "password",
  roles: [{ role: "readWrite", db: "blog-post-dev" }],
  passwordDigestor: "server",
});
