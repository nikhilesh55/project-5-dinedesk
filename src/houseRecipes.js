import paneerImage from './assets/ember-paneer.jpg';
import butterChickenImage from './assets/black-cardamom-butter-chicken.jpg';
import cauliflowerImage from './assets/tandoori-cauliflower.jpg';
import salmonImage from './assets/coastal-pepper-salmon.jpg';
import biryaniImage from './assets/saffron-smoke-lamb-biryani.jpg';

export const houseRecipes = [
  {
    id: 'ember-paneer', name: 'Ember-Roasted Paneer', course: 'VEGETARIAN · STARTER', icon: '✳', image: paneerImage,
    description: 'Silky paneer, charred over high heat, finished with smoked tomato kasundi and crisp curry leaves.',
    prep: '35 min', serves: 'Serves 2', price: '₹420', signature: 'A tiny spoon of mustard kasundi brings a sharp, bright finish to the smoky paneer.',
    ingredients: ['250 g paneer, cut into 6 thick batons', '80 g hung curd', '1 tsp Kashmiri chilli', '½ tsp roasted cumin', '1 tsp ginger-garlic paste', '1 tbsp mustard oil', '2 ripe tomatoes', '1 tsp yellow mustard seeds', '8 curry leaves', '1 tsp honey', 'Lime, salt and coriander'],
    steps: ['Whisk hung curd with chilli, cumin, ginger-garlic, half the mustard oil, lime and salt. Coat the paneer and rest for 20 minutes.', 'Char the tomatoes in a hot dry pan until blistered. Peel, crush and fold with mustard seeds, honey and a pinch of salt to make a coarse kasundi.', 'Sear paneer on a very hot griddle until dark at the edges and warm through. Brush with the remaining mustard oil.', 'Spoon kasundi onto warm plates. Set paneer over it, scatter crisped curry leaves and coriander, and serve immediately.']
  },
  {
    id: 'black-cardamom-chicken', name: 'Black Cardamom Butter Chicken', course: 'SIGNATURE · MAIN', icon: '❋', image: butterChickenImage,
    description: 'Tandoor-style chicken in a slow-simmered tomato and cashew sauce with a smoky black-cardamom finish.',
    prep: '60 min', serves: 'Serves 3', price: '₹680', signature: 'Browned butter and crushed black cardamom add a deeper, toasted aroma than a standard makhani sauce.',
    ingredients: ['500 g boneless chicken thigh, large pieces', '100 g thick yogurt', '1 tbsp lemon juice', '1 tsp Kashmiri chilli', '½ tsp turmeric', '400 g ripe tomatoes, chopped', '15 g cashews, soaked', '2 tbsp butter', '1 tsp neutral oil', '1 black cardamom pod', '1 tsp kasuri methi', '60 ml cream', 'Garam masala and salt'],
    steps: ['Marinate chicken in yogurt, lemon, chilli, turmeric and salt for at least 30 minutes. Thread or spread on a tray and roast at 230°C until lightly charred and just cooked.', 'Simmer tomatoes with oil and a pinch of salt until collapsed. Blend with drained cashews until smooth, then pass through a sieve for a restaurant-silky sauce.', 'Brown the butter gently. Crack the black cardamom and bloom it in the butter for 20 seconds. Add the tomato-cashew purée and simmer for 10 minutes.', 'Fold in chicken, kasuri methi, a pinch of garam masala and cream. Simmer 3 minutes. Finish with a little browned butter and serve with warm naan.']
  },
  {
    id: 'tandoori-cauliflower', name: 'Tandoori Cauliflower, Date & Lime', course: 'VEGAN · STARTER', icon: '✿', image: cauliflowerImage,
    description: 'Deeply roasted cauliflower with a glossy date-tamarind lacquer and cooling mint-cashew cream.',
    prep: '45 min', serves: 'Serves 2', price: '₹390', signature: 'Sweet date, tart tamarind and fresh lime make a layered glaze; toasted seeds add the final crunch.',
    ingredients: ['1 small cauliflower, cut into florets', '2 tbsp neutral oil', '1 tsp tandoori masala', '½ tsp turmeric', '2 tbsp date syrup', '1 tsp tamarind paste', '½ lime, zest and juice', '40 g cashews, soaked', 'Small bunch mint', '2 tbsp water', '1 tbsp toasted pumpkin seeds', 'Salt'],
    steps: ['Toss cauliflower with oil, tandoori masala, turmeric and salt. Roast at 220°C for 25–30 minutes, turning once, until crisp at the edges.', 'Blend cashews with mint, water, lime zest and a pinch of salt until smooth and spoonable.', 'Warm date syrup with tamarind and a tablespoon of water. Brush the hot cauliflower with the glaze and return to the oven for 3 minutes.', 'Swipe mint-cashew cream across a plate. Pile on the cauliflower, squeeze over lime and finish with toasted pumpkin seeds.']
  },
  {
    id: 'coastal-salmon', name: 'Coastal Pepper Salmon', course: "CHEF'S SPECIAL · MAIN", icon: '◉', image: salmonImage,
    description: 'Pan-crisp salmon with a coconut, curry-leaf and kokum sauce inspired by the Konkan coast.',
    prep: '30 min', serves: 'Serves 2', price: '₹760', signature: 'Kokum gives the coconut sauce a clean, fruity acidity that keeps the rich fish light.',
    ingredients: ['2 salmon fillets, skin on', '200 ml coconut milk', '2 pieces dried kokum', '½ tsp cracked black pepper', '½ tsp coriander seeds, crushed', '½ tsp turmeric', '1 small shallot, finely sliced', '8 curry leaves', '1 tsp coconut oil', '1 tsp lime juice', 'Salt and coriander'],
    steps: ['Season salmon with turmeric, salt and half the cracked pepper. Leave uncovered in the fridge for 15 minutes to dry the skin.', 'Warm coconut oil and soften shallot. Add coriander seeds, the remaining pepper and curry leaves; cook until fragrant.', 'Pour in coconut milk with kokum and a pinch of salt. Simmer gently for 8 minutes; do not boil hard. Finish with lime and remove the kokum.', 'Sear salmon skin-side down in a hot pan until crisp, then turn briefly to finish. Spoon sauce into shallow bowls, set salmon on top and garnish with coriander.']
  },
  {
    id: 'lamb-biryani', name: 'Saffron Smoke Lamb Biryani', course: 'HOUSE SPECIAL · MAIN', icon: '◒', image: biryaniImage,
    description: 'Tender spiced lamb layered with fragrant basmati, saffron yogurt, mint and crisp onions.',
    prep: '2 hr 15 min', serves: 'Serves 4', price: '₹980', signature: 'A short covered dum with a little charcoal smoke gives the rice a warm, fireside aroma.',
    ingredients: ['600 g lamb shoulder, 3 cm cubes', '300 g aged basmati rice', '150 g thick yogurt', '2 onions, thinly sliced', '1 tbsp ginger-garlic paste', '1 tsp biryani masala', '½ tsp chilli powder', 'Pinch saffron steeped in 2 tbsp warm milk', '2 tbsp ghee', '1 cinnamon stick and 3 cardamom pods', 'Mint and coriander leaves', 'Lime and salt'],
    steps: ['Marinate lamb with yogurt, ginger-garlic, biryani masala, chilli, lime and salt for 45 minutes. Brown in ghee, add a splash of water and cover until fork-tender, about 75 minutes.', 'Rinse and soak rice for 20 minutes. Boil in salted water with cinnamon and cardamom until just 70% cooked; drain well.', 'Fry onions slowly until deep golden and crisp. Layer half the rice over the lamb, add herbs, saffron milk and some onions, then top with remaining rice.', 'Seal the pot and cook over very low heat for 20 minutes. Rest unopened for 10 minutes, fluff gently from the sides and finish with herbs and crisp onions.']
  }
];
