const express = require('express');
const router = express.Router();
const controller = require('../controllers/placesController');

router.get('/debug', controller.debugTagSearch);
router.get('/cards', controller.getPlacesForCards);
router.get('/', controller.getAllPlaces);
router.get('/:id', controller.getPlaceById);
router.post('/', controller.createPlace);
router.put('/:id', controller.updatePlace);
router.patch('/:id',controller.updatePlacePartial);
router.delete('/:id', controller.deletePlace);


module.exports = router;
