const express = require('express');
const router = express.Router();
const controller = require('../controllers/usersController');

router.get('/', controller.getAllUsers);
router.get('/:id', controller.getUserById);
router.post('/', controller.createUser);
router.put('/:id', controller.updateUser);
router.patch('/:id', controller.updateUserPartial);
router.delete('/:id', controller.deleteUser);





module.exports = router;
