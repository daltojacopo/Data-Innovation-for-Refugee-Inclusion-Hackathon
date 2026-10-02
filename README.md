# An Algorithm in the Loop - K Mazzu

## The dashboard

A static dashboard mockup for the Cashy Oversight Challenge. Open `index.html` in a browser; the case data is loaded from `data/demo-cases.js`, so the prototype does not require a server or a database.

The dashboard aim at simulating a real world scenario in which a UNHCR caseworker has to evaluate the situation of an household requesting for cash assistence. 
The center, and main, part of the dashboard is focused on showing clearly and cleverly the situation to the caseworker: in order to achieve it an AI model is used to highlight the important and decision-shifting variables.
In particular, an overall of the situation is shown, such as vulnerability score, household size and whether administrative checks are showing something on the record.

Below, the variables are ordered following the importance found by the AI model, and it is shown the household values. 
If the model sense a particularly severe situation, a red flag is shown. 
It is also present a link to access the interview data, when the caseworker sense it may be useful. 

On the bottom a box let the human takes the decision, to grant or not the cash assistence to the household. 

## The simulations

The K_Mazzu_alg.pynb contains all the coding that we have done to simulate the pipeline. In particular we used the AutoGluon model, imported from the namesake library of python. That is the same model used in the real Cashy model, used in the experiment reported in the Hackhaton documentation. 

The dataset is not used in its entirety, but we sample 70% of it, on which we obtain both the test and train dataset. This choice was made so that it would be possible to apply re-sampling techniques, even if we didn't manage to do it. 

Once the model is trained, we focus on the variables: autogluon's predictor class has a feature_importance method that allows us to look inside the model to see which features play a significant role in the classification. 
The test dataset is only used to be sure that our model is performing well at reproducing the operators' classification. However, the focus here does not lie in the classification capabilities of the model, on the contrary we are only interested in extracting key features. 

Ultimately, we use shap library that connects directly to autogluon objects in order to open and explain the model, when fed a new data. Hence, without looking or analysing the ultimate classification probability, this last tool allows us to look at the determining variables of a specific household. We plot some example. 


## The written production

Lastly, in the repo we uploaded the two-pages note, in which we expand the idea of our approach and the presentation, both written in latek. 



