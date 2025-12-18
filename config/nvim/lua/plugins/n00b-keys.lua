-- Use local dev dir if it exists, otherwise fall back to GitHub
local local_dev_path = vim.fn.expand("~/code/n00bkeys")
local use_local = vim.fn.isdirectory(local_dev_path) == 1

return {
  {
    "loom99-public/n00bkeys.nvim",
    dir = use_local and local_dev_path or nil,
    lazy = false,
    opts = {},
  },
}
